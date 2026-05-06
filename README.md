# DeFi Staking Security Demo

This is a small DeFi security project that shows how common smart contract bugs can affect a staking protocol, and how those same bugs can be prevented.

The project has two versions of the staking contracts:

- a vulnerable version, built on purpose with security flaws
- a secure version, using common Solidity security patterns

The main issues demonstrated are reentrancy, improper access control, and incorrect accounting for fee-on-transfer tokens. The app also includes a simple scanner that looks through the Solidity contracts and reports the findings in the frontend.

## Submission Information

Project topic: Blockchain Security: Smart Contract Vulnerability Detection and Prevention in DeFi Applications

Team members:
| Abhinav Sharma | 885378174 | abhinavsharma@csu.fullerton.edu |

Submission responsible team member: Abhinav Sharma

Original project link:

```text
https://github.com/abhnv-shrma/defi-staking-security.git
```

## Improvements Made

This project includes further improvements beyond a basic staking contract demo:

- Added vulnerable and secure versions of ETH staking contracts to demonstrate reentrancy.
- Added `EthAttackContract` to simulate a real reentrancy attack in a controlled local environment.
- Added vulnerable and secure ERC20 staking contracts to demonstrate improper access control.
- Added vulnerable and secure fee-token staking contracts to demonstrate incorrect accounting with fee-on-transfer tokens.
- Added role-based access control with OpenZeppelin `AccessControl`.
- Added reentrancy protection with OpenZeppelin `ReentrancyGuard`.
- Added balance-delta accounting to securely support fee-on-transfer ERC20 tokens.
- Added Hardhat tests that prove the vulnerable contracts can be exploited and the secure contracts block the same attacks.
- Added a simple static scanner that generates vulnerability findings from the Solidity files.
- Added a React frontend dashboard for live demo interaction, balance tracking, scanner results, and security explanations.
- Added configurable ETH pool and attack amounts in the frontend instead of only using a fixed attack value.

## What This Project Shows

The ETH staking demo shows a reentrancy attack. The vulnerable contract sends ETH before updating the user's balance, which gives an attacker contract a chance to call `withdraw` again before the first withdrawal finishes.

The secure ETH contract fixes this by updating state first and using OpenZeppelin's `ReentrancyGuard`.

The ERC20 staking demo shows a reward-rate access-control issue. In the vulnerable contract, any wallet can change the reward rate. In the secure contract, only an address with the reward manager role can update it.

The fee-token staking demo shows an accounting bug. The vulnerable contract assumes the full requested token amount arrives during `transferFrom`, even if the token charges a transfer fee. That causes the contract to credit users for more tokens than it actually received. The secure contract measures the actual amount received and credits only that amount.

## Tech Stack

- Solidity
- Hardhat 3
- viem
- OpenZeppelin Contracts
- React
- Vite
- ethers.js

## Main Files

```text
contracts/
  VulnerableEthStaking.sol   ETH staking contract with reentrancy vulnerability
  SecureEthStaking.sol       Protected ETH staking contract
  VulnerableStaking.sol      ERC20 staking contract with weak access control
  SecureStaking.sol          ERC20 staking contract with role-based access control
  VulnerableFeeStaking.sol   Fee-token staking contract with incorrect accounting
  SecureFeeStaking.sol       Fee-token staking contract with balance-delta accounting
  EthAttackContract.sol      Attack contract used in the reentrancy demo
  MockToken.sol              Test ERC20 token
  FeeToken.sol               ERC20 token that burns a fee on transfers

scripts/
  deploy-demo.ts             Deploys the demo contracts locally
  security-scan.js           Generates the scanner report

frontend/
  src/App.jsx                Main React app
  src/contracts.json         Local deployed contract addresses
  src/security-report.json   Generated scanner results

test/
  reentrancy.test.ts
  staking.test.ts
  fee-token.test.ts
  security-scan.test.ts
```

## Setup

Install the root project dependencies:

```shell
npm install
```

Then install the frontend dependencies:

```shell
cd frontend
npm install
cd ..
```

## Running The Project Locally

The demo is meant to run on a local Hardhat chain. Use three terminals.

### 1. Start The Local Blockchain

```shell
npx hardhat node
```

Leave this running. This creates the local blockchain at:

```text
http://127.0.0.1:8545
Chain ID: 31337
```

### 2. Deploy The Demo Contracts

In a second terminal, run:

```shell
npx hardhat run scripts/deploy-demo.ts --network localhost
```

This deploys the vulnerable contracts, secure contracts, mock token, and attack contracts. It also funds the demo pools and writes the deployed addresses into:

```text
frontend/src/contracts.json
```

If you restart the Hardhat node, deploy again because the local chain resets.

### 3. Start The Frontend

In a third terminal:

```shell
cd frontend
npm run dev
```

Open the Vite URL shown in the terminal. It is usually:

```text
http://127.0.0.1:5173
```

Connect MetaMask to the Hardhat local network. If your wallet has no ETH, import one of the private keys printed by `npx hardhat node`.

## Using The Demo

In the ETH staking section, you can:

- add ETH to the vulnerable or secure pool
- choose how much ETH the attacker sends
- run the reentrancy attack against the vulnerable contract
- try the same attack against the secure contract

In the token staking section, you can:

- stake mock MTK tokens
- advance local time to increase rewards
- withdraw principal and rewards
- exploit the vulnerable reward-rate function
- try the same reward-rate change against the secure contract

In the fee-token section, you can:

- stake fee-on-transfer tokens into the vulnerable or secure contract
- compare the recorded staking balance against the actual received token amount
- see how the vulnerable contract over-credits deposits
- verify that the secure contract records only the net amount received

The explanation box at the bottom changes based on what you last interacted with.

## Running Tests

```shell
npm test
```

The tests check that:

- the reentrancy attack drains the vulnerable ETH staking contract
- the secure ETH staking contract blocks the same attack
- the vulnerable token staking contract allows unauthorized reward-rate changes
- the secure token staking contract blocks unauthorized reward-rate changes
- the vulnerable fee-token staking contract over-credits deposits
- the secure fee-token staking contract records only the actual tokens received
- the scanner finds the expected issues

## Running The Scanner

```shell
npm run scan
```

The scanner looks through the contracts and writes a report to:

```text
frontend/src/security-report.json
```

The frontend reads that file and displays the findings.

## Building The Frontend

```shell
cd frontend
npm run build
```

The built files are placed in:

```text
frontend/dist/
```

## About Sepolia

The current version is built mainly for a local Hardhat network. That makes the demo easier to reset, redeploy, fund, and test.

Deploying to Sepolia is possible, but the full frontend demo would need some changes. The app currently assumes:

- Hardhat Local chain ID `31337`
- RPC URL `http://127.0.0.1:8545`
- local deployed addresses in `frontend/src/contracts.json`
- local-only JSON-RPC calls like `evm_increaseTime`

Sepolia deployment would also require Sepolia test ETH for gas. That is not real mainnet ETH, but you still need to get it from a faucet.

## Useful Commands

```shell
npm install
npm test
npm run scan
npx hardhat node
npx hardhat run scripts/deploy-demo.ts --network localhost
cd frontend
npm run dev
npm run build
```
