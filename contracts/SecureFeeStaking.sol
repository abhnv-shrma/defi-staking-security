// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract SecureFeeStaking {
    using SafeERC20 for IERC20;

    IERC20 public stakingToken;

    mapping(address => uint256) public balances;

    event Staked(
        address indexed user,
        uint256 requestedAmount,
        uint256 receivedAmount
    );

    constructor(address _stakingToken) {
        stakingToken = IERC20(_stakingToken);
    }

    function stake(uint256 amount) external {
        require(amount > 0, "Amount must be greater than 0");

        uint256 beforeBalance = stakingToken.balanceOf(address(this));
        stakingToken.safeTransferFrom(msg.sender, address(this), amount);
        uint256 receivedAmount =
            stakingToken.balanceOf(address(this)) - beforeBalance;

        require(receivedAmount > 0, "No tokens received");

        balances[msg.sender] += receivedAmount;

        emit Staked(msg.sender, amount, receivedAmount);
    }
}
