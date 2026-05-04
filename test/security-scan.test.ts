import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

describe("Local vulnerability scanner", function () {
  it("detects injected reentrancy and access-control findings", function () {
    const output = execFileSync("node", ["scripts/security-scan.js"], {
      cwd: process.cwd(),
      encoding: "utf8",
    });

    const report = JSON.parse(output);
    const findingIds = new Set(
      report.findings.map((finding: { id: string }) => finding.id)
    );

    assert.equal(findingIds.has("REENTRANCY_TRANSFER_BEFORE_EFFECTS"), true);
    assert.equal(findingIds.has("MISSING_ACCESS_CONTROL"), true);
    assert.equal(findingIds.has("REENTRANCY_GUARD_PRESENT"), true);
    assert.equal(findingIds.has("ROLE_BASED_ACCESS_CONTROL_PRESENT"), true);
  });
});
