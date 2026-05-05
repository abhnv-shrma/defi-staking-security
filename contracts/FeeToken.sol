// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract FeeToken is ERC20 {
    uint256 public constant FEE_BASIS_POINTS = 200;
    uint256 public constant BASIS_POINTS = 10_000;

    constructor() ERC20("Fee Token", "FEE") {
        _mint(msg.sender, 1_000_000 * 10 ** decimals());
    }

    function _update(address from, address to, uint256 value) internal override {
        if (from == address(0) || to == address(0) || value == 0) {
            super._update(from, to, value);
            return;
        }

        uint256 fee = (value * FEE_BASIS_POINTS) / BASIS_POINTS;
        uint256 netAmount = value - fee;

        super._update(from, to, netAmount);
        super._update(from, address(0), fee);
    }
}
