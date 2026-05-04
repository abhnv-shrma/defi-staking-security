import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { network } from "hardhat";
import { parseEther } from "viem";

describe("Reentrancy Attack Demo", async function () {
  const { viem } = await network.connect();

  it("attacker drains ETH from vulnerable staking contract", async function () {
    const [owner, victim, attacker] = await viem.getWalletClients();
    const publicClient = await viem.getPublicClient();

    // Deploy vulnerable contract
    const staking = await viem.deployContract("VulnerableEthStaking");

    // Victim stakes ETH
    const victimStaking = await viem.getContractAt(
      "VulnerableEthStaking",
      staking.address,
      { client: { wallet: victim } }
    );

    await victimStaking.write.stake({
      value: parseEther("5"),
    });

    const attackContract = await viem.deployContract(
      "EthAttackContract",
      [staking.address],
      { client: { wallet: attacker } }
    );

    const attackerContract = await viem.getContractAt(
      "EthAttackContract",
      attackContract.address,
      { client: { wallet: attacker } }
    );

    // Execute attack
    await attackerContract.write.attack({
      value: parseEther("1"),
    });

    // Check balances after attack
    const stakingBalance = await publicClient.getBalance({
      address: staking.address,
    });

    const attackerBalance = await publicClient.getBalance({
      address: attackContract.address,
    });

    // Assertions
    assert.equal(stakingBalance, 0n);
    assert.equal(attackerBalance, parseEther("6"));
  });

  it("secure ETH staking prevents the same reentrancy attack", async function () {
    const [owner, victim, attacker] = await viem.getWalletClients();
    const publicClient = await viem.getPublicClient();

    const staking = await viem.deployContract("SecureEthStaking");

    const victimStaking = await viem.getContractAt(
      "SecureEthStaking",
      staking.address,
      { client: { wallet: victim } }
    );

    await victimStaking.write.stake({
      value: parseEther("5"),
    });

    const attackContract = await viem.deployContract(
      "EthAttackContract",
      [staking.address],
      { client: { wallet: attacker } }
    );

    const attackerContract = await viem.getContractAt(
      "EthAttackContract",
      attackContract.address,
      { client: { wallet: attacker } }
    );

    await assert.rejects(async () => {
      await attackerContract.write.attack({
        value: parseEther("1"),
      });
    });

    const stakingBalance = await publicClient.getBalance({
      address: staking.address,
    });

    const attackerBalance = await publicClient.getBalance({
      address: attackContract.address,
    });

    assert.equal(stakingBalance, parseEther("5"));
    assert.equal(attackerBalance, 0n);
  });
});
