// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract VulnerableStaking {
    IERC20 public stakingToken;

    event Staked(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 principal, uint256 reward);
    event RewardRateChanged(
        address indexed changedBy,
        uint256 oldRate,
        uint256 newRate
    );

    mapping(address => uint256) public balances;
    mapping(address => uint256) public stakingStartTime;

    uint256 public rewardRate = 10;

    constructor(address _stakingToken) {
        stakingToken = IERC20(_stakingToken);
    }

    function stake(uint256 amount) external {
        require(amount > 0, "Amount must be greater than 0");

        stakingToken.transferFrom(msg.sender, address(this), amount);

        balances[msg.sender] += amount;
        stakingStartTime[msg.sender] = block.timestamp;

        emit Staked(msg.sender, amount);
    }

    function calculateReward(address user) public view returns (uint256) {
        uint256 stakingDuration = block.timestamp - stakingStartTime[user];
        return (balances[user] * rewardRate * stakingDuration) / 1 days / 100;
    }

    function withdraw() external {
        uint256 userBalance = balances[msg.sender];
        uint256 reward = calculateReward(msg.sender);
        uint256 totalAmount = userBalance + reward;

        require(userBalance > 0, "No tokens staked");

        stakingToken.transfer(msg.sender, totalAmount);

        balances[msg.sender] = 0;

        emit Withdrawn(msg.sender, userBalance, reward);
    }

    // Vulnerability: no access control
    function changeRewardRate(uint256 newRate) external {
        uint256 oldRate = rewardRate;
        rewardRate = newRate;

        emit RewardRateChanged(msg.sender, oldRate, newRate);
    }
}
