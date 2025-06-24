// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

contract MultiSigWallet {
    event Submit (uint indexed txId);
    event Approve(address indexed owner, uint indexed txId);
    event Revoke(address indexed owner, uint indexed txId);
    event Execute(uint indexed txId);

    struct Transaction {
        address to;
        uint value;
        bytes data;
        bool executed;
        uint numApprovals;
    }

    address[] public owners;
    mapping (address => bool) public isOwner; // to tract owners
    uint public required;
    
    Transaction[] public transactions;
    mapping (uint => mapping(address => bool)) public approved; // who approved which tx

    modifier onlyOwner() {
        require(isOwner[msg.sender], "not the owner");
        _;        
    }

    constructor(address[] memory _owners, uint _required) {
        require(_owners.length > 0, "owners required"); // Check owners array not empty
        require(_required > 0 && _required <= _owners.length, "invalid required number of owners"); // checks required owners

        for (uint i; i < _owners.length; i++) {
            address owner = _owners[i];

            require(owner != address(0), "Invalid address"); // avoid zero address
            require(!isOwner[owner], "Owner is not unique"); // prevents duplicate address

            //sets state
            isOwner[owner] = true;
            owners.push(owner); 
        }

        required = _required; // stores required confirmations
    }

    function submitTx(address _to, uint _value, bytes calldata _data) external onlyOwner {
        Transaction memory newTx = Transaction ({
        to: _to,
        value: _value,
        data: _data,
        executed: false, 
        numApprovals: 0
        });  
        
        transactions.push(newTx);
        emit Submit(transactions.length - 1);
    }

    function approve(uint txId) external onlyOwner {
        require(txId < transactions.length, "tx does not exists");
        require(!approved[txId][msg.sender], "tx already approved");
        approved[txId][msg.sender] = true;
        
        Transaction storage transaction = transactions[txId];
        transaction.numApprovals += 1;

        emit Approve(msg.sender, txId);
    }

    function revoke(uint txId) external onlyOwner {
        require(txId < transactions.length, "tx does not exist");
        require(!transactions[txId].executed, "transaction has not executed");
        require(approved[txId][msg.sender] == true, "tx is not approved");
        approved[txId][msg.sender] = false;

        Transaction storage transaction = transactions[txId];
        transaction.numApprovals -= 1;

        emit Revoke(msg.sender, txId);
    }

    function execute(uint txId) external onlyOwner {
         require(txId < transactions.length, "tx does not exist");
         require(!transactions[txId].executed, "transaction has not executed");
         require(transactions[txId].numApprovals >= required, "");

        transactions[txId].executed = true;
        (bool success, ) = transactions[txId].to.call{value: transactions[txId].value}(transactions[txId].data);
        require(success, "tx failed");

        emit Execute(txId);
    }
}