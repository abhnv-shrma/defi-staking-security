import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { network } from "hardhat";

describe("DeFi Staking Security Project", async function () {
  const { viem } = await network.connect();

  it("allows a user to stake tokens in the vulnerable contract", async function () {
    const [owner, user] = await viem.getWalletClients();
    const publicClient = await viem.getPublicClient();

    const token = await viem.deployContract("MockToken");
    const vulnerableStaking = await viem.deployContract("VulnerableStaking", [
      token.address,
    ]);

    await token.write.transfer([user.account.address, 1000n * 10n ** 18n]);

    const userToken = await viem.getContractAt(
      "MockToken",
      token.address,
      { client: { wallet: user } }
    );

    await userToken.write.approve([
      vulnerableStaking.address,
      500n * 10n ** 18n,
    ]);

    const userStaking = await viem.getContractAt(
      "VulnerableStaking",
      vulnerableStaking.address,
      { client: { wallet: user } }
    );

    const stakeHash = await userStaking.write.stake([500n * 10n ** 18n]);
    const stakeReceipt = await publicClient.waitForTransactionReceipt({
      hash: stakeHash,
    });

    const balance = await vulnerableStaking.read.balances([
      user.account.address,
    ]);

    assert.equal(balance, 500n * 10n ** 18n);
    assert.equal(stakeReceipt.logs.length > 0, true);
  });

  it("blocks non-owner from changing reward rate in secure contract", async function () {
    const [owner, user] = await viem.getWalletClients();

    const token = await viem.deployContract("MockToken");
    const secureStaking = await viem.deployContract("SecureStaking", [
      token.address,
    ]);

    const userSecureStaking = await viem.getContractAt(
      "SecureStaking",
      secureStaking.address,
      { client: { wallet: user } }
    );

    await assert.rejects(async () => {
      await userSecureStaking.write.changeRewardRate([999n]);
    });
  });

  it("allows any user to exploit reward rate in vulnerable contract", async function () {
    const [owner, attacker] = await viem.getWalletClients();
    const publicClient = await viem.getPublicClient();

    const token = await viem.deployContract("MockToken");
    const vulnerableStaking = await viem.deployContract("VulnerableStaking", [
      token.address,
    ]);

    const attackerVulnerableStaking = await viem.getContractAt(
      "VulnerableStaking",
      vulnerableStaking.address,
      { client: { wallet: attacker } }
    );

    const rewardRateHash =
      await attackerVulnerableStaking.write.changeRewardRate([999n]);
    const rewardRateReceipt = await publicClient.waitForTransactionReceipt({
      hash: rewardRateHash,
    });

    const rewardRate = await vulnerableStaking.read.rewardRate();

    assert.equal(rewardRate, 999n);
    assert.equal(rewardRateReceipt.logs.length > 0, true);
  });

  it("allows a reward manager role to update secure reward rate", async function () {
    const [owner] = await viem.getWalletClients();
    const publicClient = await viem.getPublicClient();

    const token = await viem.deployContract("MockToken");
    const secureStaking = await viem.deployContract("SecureStaking", [
      token.address,
    ]);

    const rewardRateHash = await secureStaking.write.changeRewardRate([25n]);
    const rewardRateReceipt = await publicClient.waitForTransactionReceipt({
      hash: rewardRateHash,
    });

    const rewardRate = await secureStaking.read.rewardRate();

    assert.equal(rewardRate, 25n);
    assert.equal(rewardRateReceipt.logs.length > 0, true);
  });
});
