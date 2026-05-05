import { network } from "hardhat";
import fs from "fs";
import path from "path";

async function main() {
  const { viem } = await network.connect();
  const [deployer, victim] = await viem.getWalletClients();

  const token = await viem.deployContract("MockToken");
  const feeToken = await viem.deployContract("FeeToken");
  const vulnerableTokenStaking = await viem.deployContract(
    "VulnerableStaking",
    [token.address]
  );
  const secureTokenStaking = await viem.deployContract(
    "SecureStaking",
    [token.address],
    { client: { wallet: victim } }
  );
  const vulnerableFeeStaking = await viem.deployContract(
    "VulnerableFeeStaking",
    [feeToken.address]
  );
  const secureFeeStaking = await viem.deployContract("SecureFeeStaking", [
    feeToken.address,
  ]);

  const vulnerable = await viem.deployContract("VulnerableEthStaking");
  const secure = await viem.deployContract("SecureEthStaking");

  const vulnerableAttack = await viem.deployContract("EthAttackContract", [
    vulnerable.address,
  ]);

  const secureAttack = await viem.deployContract("EthAttackContract", [
    secure.address,
  ]);

  const victimVulnerable = await viem.getContractAt(
    "VulnerableEthStaking",
    vulnerable.address,
    { client: { wallet: victim } }
  );

  const victimSecure = await viem.getContractAt(
    "SecureEthStaking",
    secure.address,
    { client: { wallet: victim } }
  );

  await victimVulnerable.write.stake({
    value: 5n * 10n ** 18n,
  });

  await victimSecure.write.stake({
    value: 5n * 10n ** 18n,
  });

  await token.write.transfer([
    vulnerableTokenStaking.address,
    10_000n * 10n ** 18n,
  ]);

  await token.write.transfer([
    secureTokenStaking.address,
    10_000n * 10n ** 18n,
  ]);

  await token.write.transfer([victim.account.address, 1_000n * 10n ** 18n]);
  await feeToken.write.transfer([
    victim.account.address,
    1_000n * 10n ** 18n,
  ]);

  const data = {
    mockToken: token.address,
    feeToken: feeToken.address,
    vulnerableStaking: vulnerableTokenStaking.address,
    secureStaking: secureTokenStaking.address,
    vulnerableFeeStaking: vulnerableFeeStaking.address,
    secureFeeStaking: secureFeeStaking.address,
    vulnerableEthStaking: vulnerable.address,
    secureEthStaking: secure.address,
    vulnerableAttack: vulnerableAttack.address,
    secureAttack: secureAttack.address,
  };

  const outputPath = path.join(
    process.cwd(),
    "frontend",
    "src",
    "contracts.json"
  );

  fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));

  console.log("Demo contracts deployed:");
  console.log(data);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
