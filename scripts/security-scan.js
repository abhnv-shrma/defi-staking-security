import fs from "node:fs";
import path from "node:path";

const contractsDir = path.join(process.cwd(), "contracts");
const frontendReportPath = path.join(
  process.cwd(),
  "frontend",
  "src",
  "security-report.json"
);

const checks = [
  {
    id: "REENTRANCY_TRANSFER_BEFORE_EFFECTS",
    severity: "high",
    description:
      "External value/token transfer appears before the caller balance is cleared.",
    test(fileName, source) {
      if (!fileName.includes("Vulnerable")) {
        return false;
      }

      const transferIndex = source.search(/\.call\{value:|\.transfer\(/);
      const balanceResetIndex = source.search(/balances\[msg\.sender\]\s*=\s*0/);

      return (
        transferIndex !== -1 &&
        balanceResetIndex !== -1 &&
        transferIndex < balanceResetIndex
      );
    },
  },
  {
    id: "MISSING_ACCESS_CONTROL",
    severity: "high",
    description:
      "Administrative reward-rate update is externally callable without role/owner checks.",
    test(fileName, source) {
      if (!fileName.includes("Vulnerable")) {
        return false;
      }

      const hasRewardUpdate = /function\s+changeRewardRate\s*\(/.test(source);
      const hasAccessControl = /onlyOwner|onlyRole|AccessControl/.test(source);

      return hasRewardUpdate && !hasAccessControl;
    },
  },
  {
    id: "REENTRANCY_GUARD_PRESENT",
    severity: "info",
    description: "Secure contract uses ReentrancyGuard/nonReentrant.",
    test(fileName, source) {
      return (
        fileName.includes("Secure") &&
        /ReentrancyGuard/.test(source) &&
        /nonReentrant/.test(source)
      );
    },
  },
  {
    id: "ROLE_BASED_ACCESS_CONTROL_PRESENT",
    severity: "info",
    description: "Secure contract uses role-based access control.",
    test(fileName, source) {
      return fileName.includes("SecureStaking") && /AccessControl/.test(source);
    },
  },
];

const findings = [];

for (const fileName of fs.readdirSync(contractsDir)) {
  if (!fileName.endsWith(".sol")) {
    continue;
  }

  const filePath = path.join(contractsDir, fileName);
  const source = fs.readFileSync(filePath, "utf8");

  for (const check of checks) {
    if (check.test(fileName, source)) {
      findings.push({
        contract: fileName,
        id: check.id,
        severity: check.severity,
        description: check.description,
        source: `contracts/${fileName}`,
      });
    }
  }
}

const report = {
  generatedAt: new Date().toISOString(),
  summary: {
    high: findings.filter((finding) => finding.severity === "high").length,
    info: findings.filter((finding) => finding.severity === "info").length,
    total: findings.length,
  },
  findings,
};

fs.writeFileSync(frontendReportPath, `${JSON.stringify(report, null, 2)}\n`);

console.log(JSON.stringify(report, null, 2));
