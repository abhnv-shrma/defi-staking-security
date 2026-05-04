// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract VulnerableEthStaking {
    mapping(address => uint256) public balances;

    event Staked(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);

    function stake() external payable {
        require(msg.value > 0, "Must stake ETH");
        balances[msg.sender] += msg.value;

        emit Staked(msg.sender, msg.value);
    }

    function withdraw() external {
        uint256 amount = balances[msg.sender];
        require(amount > 0, "No ETH staked");

        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Transfer failed");

        balances[msg.sender] = 0;

        emit Withdrawn(msg.sender, amount);
    }

    receive() external payable {}
}
