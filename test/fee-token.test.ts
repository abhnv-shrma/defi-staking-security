import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { network } from "hardhat";

describe("Fee-on-transfer token accounting", async function () {
  const { viem } = await network.connect();

  it("vulnerable staking over-credits fee-on-transfer deposits", async function () {
    const [owner, user] = await viem.getWalletClients();

    const token = await viem.deployContract("FeeToken");
    const staking = await viem.deployContract("VulnerableFeeStaking", [
      token.address,
    ]);

    await token.write.transfer([user.account.address, 1_000n * 10n ** 18n]);

    const userToken = await viem.getContractAt("FeeToken", token.address, {
      client: { wallet: user },
    });
    const userStaking = await viem.getContractAt(
      "VulnerableFeeStaking",
      staking.address,
      { client: { wallet: user } }
    );

    const stakeAmount = 100n * 10n ** 18n;
    const expectedReceived = 98n * 10n ** 18n;

    await userToken.write.approve([staking.address, stakeAmount]);
    await userStaking.write.stake([stakeAmount]);

    const recordedBalance = await staking.read.balances([user.account.address]);
    const actualContractBalance = await token.read.balanceOf([staking.address]);

    assert.equal(recordedBalance, stakeAmount);
    assert.equal(actualContractBalance, expectedReceived);
  });

  it("secure staking credits only the actual fee-on-transfer amount received", async function () {
    const [owner, user] = await viem.getWalletClients();

    const token = await viem.deployContract("FeeToken");
    const staking = await viem.deployContract("SecureFeeStaking", [
      token.address,
    ]);

    await token.write.transfer([user.account.address, 1_000n * 10n ** 18n]);

    const userToken = await viem.getContractAt("FeeToken", token.address, {
      client: { wallet: user },
    });
    const userStaking = await viem.getContractAt(
      "SecureFeeStaking",
      staking.address,
      { client: { wallet: user } }
    );

    const stakeAmount = 100n * 10n ** 18n;
    const expectedReceived = 98n * 10n ** 18n;

    await userToken.write.approve([staking.address, stakeAmount]);
    await userStaking.write.stake([stakeAmount]);

    const recordedBalance = await staking.read.balances([user.account.address]);
    const actualContractBalance = await token.read.balanceOf([staking.address]);

    assert.equal(recordedBalance, expectedReceived);
    assert.equal(actualContractBalance, expectedReceived);
  });
});
