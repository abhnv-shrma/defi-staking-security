// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract VulnerableFeeStaking {
    IERC20 public stakingToken;

    mapping(address => uint256) public balances;

    event Staked(address indexed user, uint256 requestedAmount);

    constructor(address _stakingToken) {
        stakingToken = IERC20(_stakingToken);
    }

    function stake(uint256 amount) external {
        require(amount > 0, "Amount must be greater than 0");

        stakingToken.transferFrom(msg.sender, address(this), amount);

        balances[msg.sender] += amount;

        emit Staked(msg.sender, amount);
    }
}
