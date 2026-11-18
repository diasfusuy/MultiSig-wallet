const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("MultiSigWallet", () => {
  let wallet, owner1, owner2, owner3, outsider, recipient;
  const ONE_ETH = ethers.parseEther("1");

  beforeEach(async () => {
    [owner1, owner2, owner3, outsider, recipient] = await ethers.getSigners();
    const Wallet = await ethers.getContractFactory("MultiSigWallet");
    wallet = await Wallet.deploy([owner1.address, owner2.address, owner3.address], 2);
    await owner1.sendTransaction({ to: await wallet.getAddress(), value: ONE_ETH });
  });

  describe("deployment", () => {
    it("stores the owners and the approval threshold", async () => {
      expect(await wallet.isOwner(owner1.address)).to.equal(true);
      expect(await wallet.isOwner(outsider.address)).to.equal(false);
      expect(await wallet.required()).to.equal(2);
    });

    it("rejects a threshold larger than the number of owners", async () => {
      const Wallet = await ethers.getContractFactory("MultiSigWallet");
      await expect(Wallet.deploy([owner1.address], 2)).to.be.revertedWith("invalid required number of owners");
    });

    it("rejects duplicate owners", async () => {
      const Wallet = await ethers.getContractFactory("MultiSigWallet");
      await expect(Wallet.deploy([owner1.address, owner1.address], 1)).to.be.revertedWith("Owner is not unique");
    });
  });

  it("accepts ETH and emits Deposit", async () => {
    await expect(owner2.sendTransaction({ to: await wallet.getAddress(), value: ONE_ETH }))
      .to.emit(wallet, "Deposit")
      .withArgs(owner2.address, ONE_ETH);
    expect(await ethers.provider.getBalance(await wallet.getAddress())).to.equal(ONE_ETH * 2n);
  });

  it("sends ETH once enough owners approve", async () => {
    await wallet.connect(owner1).submitTx(recipient.address, ONE_ETH, "0x");
    await wallet.connect(owner1).approve(0);
    await wallet.connect(owner2).approve(0);

    await expect(wallet.connect(owner3).execute(0)).to.changeEtherBalances(
      [wallet, recipient],
      [-ONE_ETH, ONE_ETH]
    );
    expect((await wallet.transactions(0)).executed).to.equal(true);
  });

  it("does not execute with fewer approvals than required", async () => {
    await wallet.connect(owner1).submitTx(recipient.address, ONE_ETH, "0x");
    await wallet.connect(owner1).approve(0);
    await expect(wallet.connect(owner1).execute(0)).to.be.revertedWith("not enough approvals");
  });

  it("lets an owner revoke an approval before execution", async () => {
    await wallet.connect(owner1).submitTx(recipient.address, ONE_ETH, "0x");
    await wallet.connect(owner1).approve(0);
    await wallet.connect(owner2).approve(0);
    await wallet.connect(owner2).revoke(0);
    await expect(wallet.connect(owner1).execute(0)).to.be.revertedWith("not enough approvals");
  });

  it("cannot execute the same transaction twice", async () => {
    await wallet.connect(owner1).submitTx(recipient.address, ONE_ETH / 2n, "0x");
    await wallet.connect(owner1).approve(0);
    await wallet.connect(owner2).approve(0);
    await wallet.connect(owner1).execute(0);
    await expect(wallet.connect(owner1).execute(0)).to.be.revertedWith("tx already executed");
  });

  it("does not allow approving or revoking an executed transaction", async () => {
    await wallet.connect(owner1).submitTx(recipient.address, ONE_ETH / 2n, "0x");
    await wallet.connect(owner1).approve(0);
    await wallet.connect(owner2).approve(0);
    await wallet.connect(owner1).execute(0);
    await expect(wallet.connect(owner3).approve(0)).to.be.revertedWith("tx already executed");
    await expect(wallet.connect(owner1).revoke(0)).to.be.revertedWith("tx already executed");
  });

  it("blocks non-owners from every action", async () => {
    await expect(wallet.connect(outsider).submitTx(recipient.address, ONE_ETH, "0x")).to.be.revertedWith("not the owner");
    await wallet.connect(owner1).submitTx(recipient.address, ONE_ETH, "0x");
    await expect(wallet.connect(outsider).approve(0)).to.be.revertedWith("not the owner");
    await expect(wallet.connect(outsider).execute(0)).to.be.revertedWith("not the owner");
  });
});
