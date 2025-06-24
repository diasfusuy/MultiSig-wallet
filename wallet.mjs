import { computeAddress } from "ethers";
import dotenv from "dotenv";
import { Wallet } from "ethers";
dotenv.config();


const privateKey = process.env.PRIVATE_KEY;
const address = computeAddress(privateKey);
const wallet = new Wallet(privateKey);
console.log("Address:", address);

const RPC_URL = "http://127.0.0.1:8545";

// Retrieve nonce
const body = {
  jsonrpc: "2.0",
  id: 1,
  method: "eth_getTransactionCount",
  params: [address, "latest"]
};

const response = await fetch(RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
});

const json = await response.json();
console.log("Nonce (hex):", json.result);
const nonceHex = json.result;

// Address ETH will be trasnfered to
const to = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"; 
const valueInWei = BigInt(10**16);
const valueHex = "0x" + valueInWei.toString(16);

// Estimate gas
const gasEstimateBody = {
    jsonrpc: "2.0",
    id: 2,
    method: "eth_estimateGas",
    params: [
        {
            from: address,
            to: to,
            value: valueHex
        }
    ]
};

const res = await fetch(RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(gasEstimateBody)
});

const result = await res.json();
console.log("Gas estimate (hex):", result.result);
const gasHex = result.result;

// Fetch gas price
const gasPriceBody = {
    jsonrpc: "2.0",
    id: 3,
    method: "eth_gasPrice",
    params: []
};

const gasPriceBodyResponse = await fetch(RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(gasPriceBody)
});

const gasPriceJson = await gasPriceBodyResponse.json();
const gasPriceHex = gasPriceJson.result;
console.log("Gas price (hex):", gasPriceHex); 

const tx = {
  nonce: nonceHex,
  to: to,
  value: valueHex,
  gasLimit: gasHex,    // Ethers uses gasLimit, not "gas"
  gasPrice: gasPriceHex,
  chainId: 31337
};

const signedTx = await wallet.signTransaction(tx);
console.log("Raw transaction object:", tx);

const sendBody = {
  jsonrpc: "2.0",
  id: 4,
  method: "eth_sendRawTransaction",
  params: [signedTx]
};

const sendResponse = await fetch(RPC_URL, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(sendBody)
});

const sendJson = await sendResponse.json();
console.log("Transaction hash:", sendJson.result);