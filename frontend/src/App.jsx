import { useState } from "react";
import { ethers } from "ethers";
import contracts from "./contracts.json";
import securityReport from "./security-report.json";
import "./App.css";

const stakingAbi = [
  "function balances(address) view returns (uint256)",
  "function stake() payable",
  "function withdraw()",
];

const attackAbi = [
  "function attack() payable",
  "function withdrawLoot()",
];

const erc20Abi = [
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address,address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
];

const tokenStakingAbi = [
  "function balances(address) view returns (uint256)",
  "function calculateReward(address) view returns (uint256)",
  "function rewardRate() view returns (uint256)",
  "function stake(uint256)",
  "function withdraw()",
  "function changeRewardRate(uint256)",
];

const feeStakingAbi = [
  "function balances(address) view returns (uint256)",
  "function stake(uint256)",
];

const HARDHAT_RPC_URL = "http://127.0.0.1:8545";
const HARDHAT_CHAIN_ID = 31337n;
const HARDHAT_CHAIN_ID_HEX = "0x7a69";

const explanations = {
  overview: {
    title: "Security Explanation",
    paragraphs: [
      "Use the ETH staking cards to demonstrate reentrancy, or use the token staking section to demonstrate reward accounting and access-control failures.",
      "The vulnerable and secure contracts are paired so the same user action can be compared against unsafe and hardened implementations.",
    ],
  },
  ethStake: {
    title: "ETH Pool Funding",
    paragraphs: [
      "Adding ETH to a staking pool simulates users depositing funds into the protocol. In the vulnerable pool, that balance becomes the target that a reentrant attacker can drain.",
      "Changing the pool amount lets you show that exploit impact depends on available liquidity, not a fixed 5 ETH setup.",
    ],
  },
  ethReentrancy: {
    title: "ETH Reentrancy Attack",
    paragraphs: [
      "The vulnerable ETH contract sends ETH to the caller before clearing the caller's recorded balance. The attack contract uses its receive function to call withdraw again before the original withdrawal finishes.",
      "The selected attack stake amount controls the reentry chunk size. If the remaining pool balance is smaller than that amount, the attack stops with leftover ETH instead of draining the final remainder.",
    ],
  },
  secureReentrancy: {
    title: "Reentrancy Prevention",
    paragraphs: [
      "The secure ETH contract clears the user's balance before making the external ETH transfer, following the Checks-Effects-Interactions pattern.",
      "It also uses OpenZeppelin's ReentrancyGuard, so the attack contract cannot enter withdraw again while the first withdrawal is still running.",
    ],
  },
  tokenStake: {
    title: "Token Staking Rewards",
    paragraphs: [
      "The ERC20 staking demo calculates rewards from the user's staked amount, the reward rate, and how long the stake has been active.",
      "Advancing local Hardhat time increases the calculated reward, which shows how staking duration affects payout logic.",
    ],
  },
  accessControl: {
    title: "Improper Access Control",
    paragraphs: [
      "The vulnerable token staking contract lets any wallet call changeRewardRate, so an attacker can set an extreme reward rate before withdrawing.",
      "The secure token staking contract protects that function with a reward-manager role, preventing normal users from changing administrative parameters.",
    ],
  },
  feeToken: {
    title: "Fee-On-Transfer Accounting Bug",
    paragraphs: [
      "Some ERC20 tokens take a fee every time they are transferred. If a user stakes 100 FEE, this demo token burns 2%, so the staking contract only receives 98 FEE.",
      "The vulnerable staking contract records the requested 100 FEE anyway. The secure version measures its token balance before and after the transfer, then credits only the actual amount received.",
    ],
  },
  scanner: {
    title: "Automated Vulnerability Detection",
    paragraphs: [
      "The scanner reads the Solidity files and flags simple vulnerability patterns, including transfer-before-balance-reset and missing access control on reward-rate updates.",
      "It also reports positive hardening signals such as ReentrancyGuard and role-based access control in the secure contracts.",
    ],
  },
};

function App() {
  const [account, setAccount] = useState("");
  const [status, setStatus] = useState("");
  const [currentExplanation, setCurrentExplanation] = useState("overview");
  const [balances, setBalances] = useState({
    vulnerable: "0",
    secure: "0",
    vulnerableAttack: "0",
    secureAttack: "0",
  });
  const [tokenData, setTokenData] = useState({
    walletBalance: "0",
    vulnerablePool: "0",
    securePool: "0",
    vulnerableStaked: "0",
    secureStaked: "0",
    vulnerableReward: "0",
    secureReward: "0",
    vulnerableRate: "0",
    secureRate: "0",
  });
  const [feeData, setFeeData] = useState({
    walletBalance: "0",
    vulnerablePool: "0",
    securePool: "0",
    vulnerableRecorded: "0",
    secureRecorded: "0",
  });
  const [ethStakeAmount, setEthStakeAmount] = useState("5");
  const [attackAmount, setAttackAmount] = useState("1");
  const [stakeAmount, setStakeAmount] = useState("100");
  const [feeStakeAmount, setFeeStakeAmount] = useState("100");
  const [rewardRate, setRewardRate] = useState("999");

  const isVulnerableDrained = Number(balances.vulnerable) <= 0;
  const tokenDemoConfigured =
    contracts.mockToken && contracts.vulnerableStaking && contracts.secureStaking;
  const feeDemoConfigured =
    contracts.feeToken &&
    contracts.vulnerableFeeStaking &&
    contracts.secureFeeStaking;
  const statusTone = status.toLowerCase().includes("blocked")
    ? "warning"
    : status.toLowerCase().includes("stopped")
      ? "warning"
      : status.toLowerCase().includes("succeeded")
        ? "danger"
        : status.toLowerCase().includes("refreshed")
          ? "info"
          : "neutral";
  const explanation = explanations[currentExplanation];

  function formatAddress(address) {
    if (!address) {
      return "Not connected";
    }

    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }

  function formatToken(value) {
    const formatted = ethers.formatEther(value);
    const numericValue = Number(formatted);

    if (!Number.isFinite(numericValue)) {
      return formatted;
    }

    return numericValue.toLocaleString(undefined, {
      maximumFractionDigits: 4,
    });
  }

  function getExpectedFeeReceived() {
    try {
      const amount = ethers.parseEther(feeStakeAmount || "0");
      return formatToken((amount * 98n) / 100n);
    } catch {
      return "0";
    }
  }

  function getErrorMessage(error) {
    const message = error.reason || error.message || "Unknown error";

    if (
      error.code === "NONCE_EXPIRED" ||
      message.toLowerCase().includes("nonce has already been used") ||
      message.toLowerCase().includes("nonce too low")
    ) {
      return "MetaMask nonce is stale. In MetaMask, go to Settings > Advanced > Clear activity and nonce data, then reconnect to Hardhat Local.";
    }

    return message;
  }

  async function getProvider() {
    if (!window.ethereum) {
      throw new Error("MetaMask not found");
    }

    return new ethers.BrowserProvider(window.ethereum);
  }

  function getLocalProvider() {
    return new ethers.JsonRpcProvider(HARDHAT_RPC_URL);
  }

  async function switchToHardhatNetwork() {
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: HARDHAT_CHAIN_ID_HEX }],
      });
    } catch (error) {
      if (error.code !== 4902) {
        throw error;
      }

      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: HARDHAT_CHAIN_ID_HEX,
            chainName: "Hardhat Local",
            nativeCurrency: {
              name: "Ethereum",
              symbol: "ETH",
              decimals: 18,
            },
            rpcUrls: [HARDHAT_RPC_URL],
          },
        ],
      });
    }
  }

  async function getReadySigner() {
    await switchToHardhatNetwork();

    const provider = await getProvider();
    const network = await provider.getNetwork();

    if (network.chainId !== HARDHAT_CHAIN_ID) {
      throw new Error(
        `MetaMask is on chain ${network.chainId}. Switch to Hardhat Local (${HARDHAT_CHAIN_ID}).`
      );
    }

    const signer = await provider.getSigner();
    const signerAddress = await signer.getAddress();
    const signerBalance = await provider.getBalance(signerAddress);

    if (signerBalance < ethers.parseEther("1")) {
      throw new Error(
        `MetaMask sees ${signerAddress} with ${ethers.formatEther(
          signerBalance
        )} ETH. Reconnect MetaMask to ${HARDHAT_RPC_URL} and reset the local account.`
      );
    }

    return signer;
  }

  async function connectWallet() {
    await switchToHardhatNetwork();

    const provider = await getProvider();
    const signer = await provider.getSigner();
    const signerAddress = await signer.getAddress();
    setAccount(signerAddress);
    setStatus("Wallet connected");
    await refreshBalances({ accountOverride: signerAddress });
  }

  async function refreshBalances({
    showStatus = false,
    accountOverride = account,
  } = {}) {
    try {
      if (showStatus) {
        setStatus("Refreshing balances from local Hardhat...");
      }

      const provider = getLocalProvider();

      const vulnerableBalance = await provider.getBalance(
        contracts.vulnerableEthStaking
      );

      const secureBalance = await provider.getBalance(
        contracts.secureEthStaking
      );

      const vulnerableAttackBalance = await provider.getBalance(
        contracts.vulnerableAttack
      );

      const secureAttackBalance = await provider.getBalance(
        contracts.secureAttack
      );

      const blockNumber = await provider.getBlockNumber();

      setBalances({
        vulnerable: ethers.formatEther(vulnerableBalance),
        secure: ethers.formatEther(secureBalance),
        vulnerableAttack: ethers.formatEther(vulnerableAttackBalance),
        secureAttack: ethers.formatEther(secureAttackBalance),
      });

      await refreshTokenData(accountOverride);
      await refreshFeeData(accountOverride);

      if (showStatus) {
        setStatus(`Balances refreshed from local Hardhat block ${blockNumber}.`);
      }
    } catch (error) {
      setStatus(
        "Balance refresh failed: " +
          getErrorMessage(error)
      );
    }
  }

  async function getLocalEthBalance(address) {
    const provider = getLocalProvider();
    return provider.getBalance(address);
  }

  async function stakeEth(contractKey) {
    try {
      setCurrentExplanation("ethStake");
      const amount = ethers.parseEther(ethStakeAmount || "0");

      if (amount <= 0n) {
        setStatus("Enter an ETH staking amount greater than 0.");
        return;
      }

      const signer = await getReadySigner();
      const staking = new ethers.Contract(
        contracts[contractKey],
        stakingAbi,
        signer
      );

      setStatus(`Staking ${ethStakeAmount} ETH into the demo pool...`);
      const tx = await staking.stake({
        value: amount,
        gasLimit: 250000,
      });
      await tx.wait();

      setStatus(`${ethStakeAmount} ETH added to the demo pool.`);
      await refreshBalances();
    } catch (error) {
      setStatus("ETH staking failed: " + getErrorMessage(error));
    }
  }

  async function refreshTokenData(accountOverride = account) {
    if (!tokenDemoConfigured) {
      return;
    }

    const provider = getLocalProvider();
    const token = new ethers.Contract(contracts.mockToken, erc20Abi, provider);
    const vulnerableStaking = new ethers.Contract(
      contracts.vulnerableStaking,
      tokenStakingAbi,
      provider
    );
    const secureStaking = new ethers.Contract(
      contracts.secureStaking,
      tokenStakingAbi,
      provider
    );

    const wallet = accountOverride || ethers.ZeroAddress;
    const [
      walletBalance,
      vulnerablePool,
      securePool,
      vulnerableStaked,
      secureStaked,
      vulnerableReward,
      secureReward,
      vulnerableRate,
      secureRate,
    ] = await Promise.all([
      token.balanceOf(wallet),
      token.balanceOf(contracts.vulnerableStaking),
      token.balanceOf(contracts.secureStaking),
      vulnerableStaking.balances(wallet),
      secureStaking.balances(wallet),
      vulnerableStaking.calculateReward(wallet),
      secureStaking.calculateReward(wallet),
      vulnerableStaking.rewardRate(),
      secureStaking.rewardRate(),
    ]);

    setTokenData({
      walletBalance: formatToken(walletBalance),
      vulnerablePool: formatToken(vulnerablePool),
      securePool: formatToken(securePool),
      vulnerableStaked: formatToken(vulnerableStaked),
      secureStaked: formatToken(secureStaked),
      vulnerableReward: formatToken(vulnerableReward),
      secureReward: formatToken(secureReward),
      vulnerableRate: vulnerableRate.toString(),
      secureRate: secureRate.toString(),
    });
  }

  async function refreshFeeData(accountOverride = account) {
    if (!feeDemoConfigured) {
      return;
    }

    const provider = getLocalProvider();
    const token = new ethers.Contract(contracts.feeToken, erc20Abi, provider);
    const vulnerableStaking = new ethers.Contract(
      contracts.vulnerableFeeStaking,
      feeStakingAbi,
      provider
    );
    const secureStaking = new ethers.Contract(
      contracts.secureFeeStaking,
      feeStakingAbi,
      provider
    );

    const wallet = accountOverride || ethers.ZeroAddress;
    const [
      walletBalance,
      vulnerablePool,
      securePool,
      vulnerableRecorded,
      secureRecorded,
    ] = await Promise.all([
      token.balanceOf(wallet),
      token.balanceOf(contracts.vulnerableFeeStaking),
      token.balanceOf(contracts.secureFeeStaking),
      vulnerableStaking.balances(wallet),
      secureStaking.balances(wallet),
    ]);

    setFeeData({
      walletBalance: formatToken(walletBalance),
      vulnerablePool: formatToken(vulnerablePool),
      securePool: formatToken(securePool),
      vulnerableRecorded: formatToken(vulnerableRecorded),
      secureRecorded: formatToken(secureRecorded),
    });
  }

  async function stakeFeeTokens(contractKey) {
    try {
      setCurrentExplanation("feeToken");

      if (!feeDemoConfigured) {
        setStatus("Fee-token staking demo is not deployed. Redeploy the demo first.");
        return;
      }

      const amount = ethers.parseEther(feeStakeAmount || "0");

      if (amount <= 0n) {
        setStatus("Enter a fee-token staking amount greater than 0.");
        return;
      }

      const signer = await getReadySigner();
      const token = new ethers.Contract(contracts.feeToken, erc20Abi, signer);
      const stakingAddress = contracts[contractKey];
      const staking = new ethers.Contract(stakingAddress, feeStakingAbi, signer);

      setStatus(`Approving ${feeStakeAmount} FEE for staking...`);
      const approveTx = await token.approve(stakingAddress, amount);
      await approveTx.wait();

      setStatus(`Staking ${feeStakeAmount} FEE...`);
      const stakeTx = await staking.stake(amount, { gasLimit: 300000 });
      await stakeTx.wait();

      setStatus(
        contractKey === "vulnerableFeeStaking"
          ? `Vulnerable staking recorded the requested ${feeStakeAmount} FEE even though the token charged a transfer fee.`
          : "Secure staking credited only the actual FEE received after the transfer fee."
      );
      await refreshBalances();
    } catch (error) {
      setStatus("Fee-token staking failed: " + getErrorMessage(error));
    }
  }

  async function advanceRewardTime() {
    try {
      setCurrentExplanation("tokenStake");
      const provider = getLocalProvider();

      setStatus("Advancing local Hardhat time by 1 minute...");
      await provider.send("evm_increaseTime", [60]);
      await provider.send("evm_mine", []);
      await refreshBalances();
      setStatus("Advanced local Hardhat time by 1 minute and refreshed rewards.");
    } catch (error) {
      setStatus("Time advance failed: " + getErrorMessage(error));
    }
  }

  async function stakeTokens(contractKey) {
    try {
      setCurrentExplanation("tokenStake");
      if (!tokenDemoConfigured) {
        setStatus("Token staking demo is not deployed. Redeploy the demo first.");
        return;
      }

      const amount = ethers.parseEther(stakeAmount || "0");

      if (amount <= 0n) {
        setStatus("Enter a token staking amount greater than 0.");
        return;
      }

      const signer = await getReadySigner();
      const token = new ethers.Contract(contracts.mockToken, erc20Abi, signer);
      const stakingAddress = contracts[contractKey];
      const staking = new ethers.Contract(
        stakingAddress,
        tokenStakingAbi,
        signer
      );

      setStatus(`Approving ${stakeAmount} MTK for staking...`);
      const approveTx = await token.approve(stakingAddress, amount);
      await approveTx.wait();

      setStatus(`Staking ${stakeAmount} MTK...`);
      const stakeTx = await staking.stake(amount, { gasLimit: 300000 });
      await stakeTx.wait();

      setStatus(`${stakeAmount} MTK staked successfully.`);
      await refreshBalances();
    } catch (error) {
      setStatus(
        "Token staking failed: " +
          getErrorMessage(error)
      );
    }
  }

  async function withdrawTokens(contractKey) {
    try {
      setCurrentExplanation("tokenStake");
      const signer = await getReadySigner();
      const staking = new ethers.Contract(
        contracts[contractKey],
        tokenStakingAbi,
        signer
      );

      setStatus("Withdrawing staked MTK and accrued rewards...");
      const tx = await staking.withdraw({ gasLimit: 350000 });
      await tx.wait();

      setStatus("Token withdrawal completed.");
      await refreshBalances();
    } catch (error) {
      setStatus(
        "Token withdrawal failed: " +
          getErrorMessage(error)
      );
    }
  }

  async function changeRewardRate(contractKey) {
    try {
      setCurrentExplanation("accessControl");
      const newRate = BigInt(rewardRate || "0");
      const signer = await getReadySigner();
      const staking = new ethers.Contract(
        contracts[contractKey],
        tokenStakingAbi,
        signer
      );

      setStatus(`Changing reward rate to ${newRate.toString()}...`);
      const tx = await staking.changeRewardRate(newRate, {
        gasLimit: 250000,
      });
      await tx.wait();

      setStatus(
        contractKey === "vulnerableStaking"
          ? "Exploit succeeded: vulnerable reward rate was changed by any wallet."
          : "Secure reward rate changed by an authorized role."
      );
      await refreshBalances();
    } catch (error) {
      setStatus(
        contractKey === "secureStaking" &&
          !getErrorMessage(error).includes("nonce")
          ? "Access-control protection worked: unauthorized reward-rate change was blocked."
          : "Reward-rate change failed: " + getErrorMessage(error)
      );
      await refreshBalances();
    }
  }

  async function runVulnerableAttack() {
    try {
      setCurrentExplanation("ethReentrancy");
      setStatus("Running reentrancy attack on vulnerable contract...");
      const amount = ethers.parseEther(attackAmount || "0");

      if (amount <= 0n) {
        setStatus("Enter an attack stake amount greater than 0.");
        return;
      }

      const vulnerableBalance = await getLocalEthBalance(
        contracts.vulnerableEthStaking
      );

      if (vulnerableBalance < amount) {
        setStatus(
          `Attack stopped: vulnerable contract needs at least ${attackAmount} ETH available before the attack.`
        );
        await refreshBalances();
        return;
      }

      const signer = await getReadySigner();

      const attackContract = new ethers.Contract(
        contracts.vulnerableAttack,
        attackAbi,
        signer
      );

      const tx = await attackContract.attack({
        value: amount,
        gasLimit: 500000,
      });

      await tx.wait();

      const remainingBalance = await getLocalEthBalance(
        contracts.vulnerableEthStaking
      );

      setStatus(
        remainingBalance === 0n
          ? "Attack succeeded. Vulnerable contract was drained."
          : `Attack succeeded. ${ethers.formatEther(
              remainingBalance
            )} ETH remains because it is below the selected attack stake amount.`
      );
      await refreshBalances();
    } catch (error) {
      setStatus(
        "Attack blocked: " + getErrorMessage(error)
      );
    }
  }

  async function runSecureAttack() {
    try {
      setCurrentExplanation("secureReentrancy");
      setStatus("Attempting same attack on secure contract...");
      const amount = ethers.parseEther(attackAmount || "0");

      if (amount <= 0n) {
        setStatus("Enter an attack stake amount greater than 0.");
        return;
      }

      const signer = await getReadySigner();

      const attackContract = new ethers.Contract(
        contracts.secureAttack,
        attackAbi,
        signer
      );

      const tx = await attackContract.attack({
        value: amount,
        gasLimit: 500000,
      });

      await tx.wait();

      setStatus("Unexpected: secure attack succeeded");
      await refreshBalances();
    } catch (error) {
      setStatus(
        "Attack blocked. Secure contract prevented reentrancy using ReentrancyGuard + CEI."
      );
      await refreshBalances();
    }
  }

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">Local Hardhat demo</p>
          <h1>DeFi Smart Contract Security Demo</h1>
          <p className="subtitle">
            Compare a vulnerable ETH staking contract against a guarded version
            under the same reentrancy attack.
          </p>
        </div>

        <div className="toolbar">
          <button className="button primary" onClick={connectWallet}>
            Connect Wallet
          </button>
          <button
            className="button secondary"
            onClick={() => refreshBalances({ showStatus: true })}
          >
            Refresh Balances
          </button>
        </div>
      </section>

      <section className="connection-panel" aria-label="Connection details">
        <div>
          <span className="label">Connected wallet</span>
          <strong>{formatAddress(account)}</strong>
        </div>
        <div>
          <span className="label">Expected network</span>
          <strong>Hardhat Local 31337</strong>
        </div>
        <div>
          <span className="label">Balance source</span>
          <strong>127.0.0.1:8545</strong>
        </div>
      </section>

      <section className="eth-controls">
        <div>
          <p className="eyebrow">ETH staking controls</p>
          <h2>Change Pool And Attack Amounts</h2>
        </div>
        <div className="input-row">
          <label>
            Pool stake amount
            <input
              value={ethStakeAmount}
              onChange={(event) => setEthStakeAmount(event.target.value)}
              inputMode="decimal"
            />
          </label>
          <label>
            Attack stake amount
            <input
              value={attackAmount}
              onChange={(event) => setAttackAmount(event.target.value)}
              inputMode="decimal"
            />
          </label>
        </div>
      </section>

      <section className="contract-grid">
        <article className="contract-card vulnerable">
          <div className="card-header">
            <p className="eyebrow">Vulnerable</p>
            <h2>ETH Staking</h2>
          </div>
          <div className="metric-list">
            <div className="metric">
              <span>Contract Balance</span>
              <strong>{balances.vulnerable} ETH</strong>
            </div>
            <div className="metric">
              <span>Attack Contract Balance</span>
              <strong>{balances.vulnerableAttack} ETH</strong>
            </div>
          </div>
          <div className="button-row eth-actions">
            <button
              className="button secondary"
              onClick={() => stakeEth("vulnerableEthStaking")}
            >
              Add Pool ETH
            </button>
            <button
              className="button danger"
              disabled={isVulnerableDrained}
              onClick={runVulnerableAttack}
            >
              Run Reentrancy Attack
            </button>
          </div>
        </article>

        <article className="contract-card secure">
          <div className="card-header">
            <p className="eyebrow">Secure</p>
            <h2>ETH Staking</h2>
          </div>
          <div className="metric-list">
            <div className="metric">
              <span>Contract Balance</span>
              <strong>{balances.secure} ETH</strong>
            </div>
            <div className="metric">
              <span>Attack Contract Balance</span>
              <strong>{balances.secureAttack} ETH</strong>
            </div>
          </div>
          <div className="button-row eth-actions">
            <button
              className="button secondary"
              onClick={() => stakeEth("secureEthStaking")}
            >
              Add Pool ETH
            </button>
            <button className="button success" onClick={runSecureAttack}>
              Attempt Same Attack
            </button>
          </div>
        </article>
      </section>

      <section className="token-demo">
        <div className="section-heading">
          <div>
            <p className="eyebrow">ERC20 staking protocol</p>
            <h2>Token Staking, Rewards, And Access Control</h2>
          </div>
          <div className="input-row">
            <label>
              Stake amount
              <input
                value={stakeAmount}
                onChange={(event) => setStakeAmount(event.target.value)}
                inputMode="decimal"
              />
            </label>
            <label>
              Test reward rate
              <input
                value={rewardRate}
                onChange={(event) => setRewardRate(event.target.value)}
                inputMode="numeric"
              />
            </label>
            <button className="button secondary" onClick={advanceRewardTime}>
              Advance 1 Minute
            </button>
          </div>
        </div>

        {!tokenDemoConfigured ? (
          <div className="notice">
            Redeploy the demo to add ERC20 staking addresses to contracts.json.
          </div>
        ) : (
          <>
            <div className="token-summary">
              <div className="metric">
                <span>Wallet MTK Balance</span>
                <strong>{tokenData.walletBalance} MTK</strong>
              </div>
              <div className="metric">
                <span>Vulnerable Reward Rate</span>
                <strong>{tokenData.vulnerableRate}%</strong>
              </div>
              <div className="metric">
                <span>Secure Reward Rate</span>
                <strong>{tokenData.secureRate}%</strong>
              </div>
            </div>

            <div className="contract-grid">
              <article className="contract-card vulnerable">
                <div className="card-header">
                  <p className="eyebrow">Vulnerable token staking</p>
                  <h2>No Admin Guard</h2>
                </div>
                <div className="metric-list">
                  <div className="metric">
                    <span>Reward Pool</span>
                    <strong>{tokenData.vulnerablePool} MTK</strong>
                  </div>
                  <div className="metric">
                    <span>Your Stake</span>
                    <strong>{tokenData.vulnerableStaked} MTK</strong>
                  </div>
                  <div className="metric">
                    <span>Estimated Reward</span>
                    <strong>{tokenData.vulnerableReward} MTK</strong>
                  </div>
                </div>
                <div className="button-row">
                  <button
                    className="button danger"
                    onClick={() => stakeTokens("vulnerableStaking")}
                  >
                    Stake Vulnerable
                  </button>
                  <button
                    className="button secondary"
                    onClick={() => withdrawTokens("vulnerableStaking")}
                  >
                    Withdraw
                  </button>
                  <button
                    className="button danger"
                    onClick={() => changeRewardRate("vulnerableStaking")}
                  >
                    Exploit Reward Rate
                  </button>
                </div>
              </article>

              <article className="contract-card secure">
                <div className="card-header">
                  <p className="eyebrow">Secure token staking</p>
                  <h2>Role Protected</h2>
                </div>
                <div className="metric-list">
                  <div className="metric">
                    <span>Reward Pool</span>
                    <strong>{tokenData.securePool} MTK</strong>
                  </div>
                  <div className="metric">
                    <span>Your Stake</span>
                    <strong>{tokenData.secureStaked} MTK</strong>
                  </div>
                  <div className="metric">
                    <span>Estimated Reward</span>
                    <strong>{tokenData.secureReward} MTK</strong>
                  </div>
                </div>
                <div className="button-row">
                  <button
                    className="button success"
                    onClick={() => stakeTokens("secureStaking")}
                  >
                    Stake Secure
                  </button>
                  <button
                    className="button secondary"
                    onClick={() => withdrawTokens("secureStaking")}
                  >
                    Withdraw
                  </button>
                  <button
                    className="button success"
                    onClick={() => changeRewardRate("secureStaking")}
                  >
                    Attempt Unauthorized Change
                  </button>
                </div>
              </article>
            </div>
          </>
        )}
      </section>

      <section className="token-demo">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Fee-on-transfer token</p>
            <h2>Accounting Bug In Staking Deposits</h2>
          </div>
          <div className="input-row">
            <label>
              Fee-token stake
              <input
                value={feeStakeAmount}
                onChange={(event) => setFeeStakeAmount(event.target.value)}
                inputMode="decimal"
              />
            </label>
          </div>
        </div>

        {!feeDemoConfigured ? (
          <div className="notice">
            Redeploy the demo to add fee-token staking addresses to contracts.json.
          </div>
        ) : (
          <>
            <div className="token-summary">
              <div className="metric">
                <span>Wallet FEE Balance</span>
                <strong>{feeData.walletBalance} FEE</strong>
              </div>
              <div className="metric">
                <span>Transfer Fee</span>
                <strong>2%</strong>
              </div>
              <div className="metric">
                <span>Expected Received</span>
                <strong>{getExpectedFeeReceived()} FEE</strong>
              </div>
            </div>

            <div className="contract-grid">
              <article className="contract-card vulnerable">
                <div className="card-header">
                  <p className="eyebrow">Vulnerable fee staking</p>
                  <h2>Credits Requested Amount</h2>
                </div>
                <div className="metric-list">
                  <div className="metric">
                    <span>Actual Contract Balance</span>
                    <strong>{feeData.vulnerablePool} FEE</strong>
                  </div>
                  <div className="metric">
                    <span>Your Recorded Stake</span>
                    <strong>{feeData.vulnerableRecorded} FEE</strong>
                  </div>
                </div>
                <button
                  className="button danger"
                  onClick={() => stakeFeeTokens("vulnerableFeeStaking")}
                >
                  Stake Vulnerable FEE
                </button>
              </article>

              <article className="contract-card secure">
                <div className="card-header">
                  <p className="eyebrow">Secure fee staking</p>
                  <h2>Credits Actual Received</h2>
                </div>
                <div className="metric-list">
                  <div className="metric">
                    <span>Actual Contract Balance</span>
                    <strong>{feeData.securePool} FEE</strong>
                  </div>
                  <div className="metric">
                    <span>Your Recorded Stake</span>
                    <strong>{feeData.secureRecorded} FEE</strong>
                  </div>
                </div>
                <button
                  className="button success"
                  onClick={() => stakeFeeTokens("secureFeeStaking")}
                >
                  Stake Secure FEE
                </button>
              </article>
            </div>
          </>
        )}
      </section>

      <section className={`status-panel ${statusTone}`}>
        <h2>Status</h2>
        <p>{status || "Connect a wallet or refresh balances to begin."}</p>
      </section>

      <section className="scanner-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Automated vulnerability detection</p>
            <h2>Static Scanner Findings</h2>
          </div>
          <div className="scanner-summary">
            <span>{securityReport.summary.high} high</span>
            <span>{securityReport.summary.info} info</span>
            <span>{securityReport.summary.total} total</span>
            <button
              className="button secondary"
              onClick={() => setCurrentExplanation("scanner")}
            >
              Explain Scanner
            </button>
          </div>
        </div>

        <p className="scanner-meta">
          Generated by <strong>npm run scan</strong>: {securityReport.generatedAt}
        </p>

        <div className="finding-list">
          {securityReport.findings.length === 0 ? (
            <div className="notice">
              No generated findings yet. Run npm run scan from the project root.
            </div>
          ) : (
            securityReport.findings.map((finding) => (
              <article
                className={`finding ${finding.severity}`}
                key={`${finding.contract}-${finding.id}`}
              >
                <div>
                  <span className="finding-severity">{finding.severity}</span>
                  <h3>{finding.id.replaceAll("_", " ")}</h3>
                  <p>{finding.description}</p>
                </div>
                <strong>{finding.source}</strong>
              </article>
            ))
          )}
        </div>
      </section>

      <section className="explanation">
        <h2>{explanation.title}</h2>
        {explanation.paragraphs.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </section>
    </main>
  );
}

export default App;
