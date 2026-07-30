import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  RUNTIME_PROOF,
  bestCandidates,
  conflictViolations,
  generateCandidates,
  generatePartitions,
  generatePolicies,
  hasGatewayPair,
  hostRootSemanticCost,
  stageCounts,
  stagePass,
} from "../src/model.js";

const candidates = generateCandidates();

const selectedOptions = {
  strictIsolation: false,
  requireAtomic: true,
  boundFallback: true,
  wholeUpgrade: true,
  requireGroupRecovery: true,
};

test("runtime proof metadata stays exact", () => {
  assert.equal(RUNTIME_PROOF.checkCount, 22);
  assert.equal(RUNTIME_PROOF.chambersCommit, "17543edafb53c007582886032df07af8297f4f5a");
  assert.equal(RUNTIME_PROOF.iiiCommit, "56c4304aa368efdc925b69baaf6356cc723ba0ca");
  assert.equal(RUNTIME_PROOF.mechanisms.length, 5);
  assert.match(RUNTIME_PROOF.pending, /containerd\/CNI-plugin.*storage-driver.*deployment/);
});

test("public copy keeps embodiment provenance outside formal semantics", () => {
  const app = readFileSync(new URL("../app.js", import.meta.url), "utf8");
  const index = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");
  assert.doesNotMatch(app, /represented by the governing formal release:.*Engine PID 1/);
  assert.doesNotMatch(app, /PID 1 after exec|EXEC ENGINE/);
  assert.doesNotMatch(index, /WHY ONE APPLIANCE|ACCEPTED RISK/);
  assert.doesNotMatch(readme, /residual risk accepted by the governing formal release/);
  assert.match(app, /bounded embodiment provenance, not formal semantics/);
  assert.match(index, /BOUNDED EMBODIMENT PROVENANCE/);
  assert.match(index, /NOT A FORMAL PRODUCTION-RISK ACCEPTANCE/);
  assert.match(readme, /does \*\*not\*\* specify Engine PID placement/);
});

test("the v3 grammar is exhaustively enumerated", () => {
  assert.equal(generatePartitions().length, 52);
  assert.equal(generatePolicies().length, 576);
  assert.equal(candidates.length, 29_952);
  assert.deepEqual(stageCounts(candidates, selectedOptions), [29_952, 14_976, 9_984, 2_496, 2_496, 2_496]);
});

test("strict cross-role isolation remains an explicit sensitivity profile", () => {
  const partitions = generatePartitions().filter((partition) => conflictViolations(partition).length === 0);
  assert.equal(partitions.length, 2);
  assert.deepEqual(partitions.map((partition) => partition.blocks.length).sort(), [4, 5]);
  const minimum = partitions.find((partition) => partition.blocks.length === 4);
  assert.ok(minimum);
  assert.equal(hasGatewayPair(minimum), true);

  const strictCounts = stageCounts(candidates, { ...selectedOptions, strictIsolation: true });
  assert.deepEqual(strictCounts, [29_952, 14_976, 9_984, 2_496, 96, 96]);
});

test("one Core task survives selected constraints but fails a re-promoted isolation edge", () => {
  const oneContainer = candidates.find((candidate) =>
    candidate.partition.blocks.length === 1
    && candidate.policy.selector === "atomic"
    && candidate.policy.fallback === "bounded_lkg"
    && candidate.policy.upgrade === "whole_set"
    && candidate.policy.recovery === "group"
  );
  assert.ok(oneContainer);
  assert.equal(stagePass(oneContainer, 4, selectedOptions), true);
  assert.equal(stagePass(oneContainer, 4, { ...selectedOptions, strictIsolation: true }), false);
  assert.equal(conflictViolations(oneContainer.partition).length, 9);
  assert.equal(hostRootSemanticCost(oneContainer.partition), 1);
});

test("the selected Ark Core objective has one deterministic optimum", () => {
  const feasible = candidates.filter((candidate) => stagePass(candidate, 4, selectedOptions));
  const best = bestCandidates(feasible, "ark_core");
  assert.equal(best.length, 1);
  assert.equal(best[0].partition.blocks.length, 1);
  assert.equal(hasGatewayPair(best[0].partition), true);
  assert.equal(best[0].policy.boot, "persistence_first");
  assert.equal(best[0].policy.writer, "persistence");
  assert.equal(best[0].policy.fallback, "bounded_lkg");
  assert.equal(best[0].policy.recovery, "group");
  assert.equal(best[0].policy.release, "child_scope");
  assert.equal(best[0].policy.packaging, "shared_image");
});

test("the strict-isolation objective recovers the former four-boundary answer", () => {
  const feasible = candidates.filter((candidate) => stagePass(candidate, 4, selectedOptions));
  const strict = bestCandidates(feasible, "strict");
  assert.equal(strict.length, 1);
  assert.equal(strict[0].partition.blocks.length, 4);
  assert.equal(conflictViolations(strict[0].partition).length, 0);
  assert.equal(hasGatewayPair(strict[0].partition), true);
  assert.equal(strict[0].policy.packaging, "bundle_index");
  assert.equal(strict[0].policy.recovery, "group");
  assert.ok(hostRootSemanticCost(strict[0].partition) > hostRootSemanticCost(bestCandidates(feasible, "ark_core")[0].partition));
});

test("availability sensitivity can reopen member recovery without changing the selected profile", () => {
  const availabilityOptions = { ...selectedOptions, requireGroupRecovery: false };
  const feasible = candidates.filter((candidate) => stagePass(candidate, 4, availabilityOptions));
  const best = bestCandidates(feasible, "availability");
  assert.equal(best.length, 1);
  assert.equal(best[0].partition.blocks.length, 4);
  assert.equal(best[0].policy.recovery, "member");
  assert.equal(conflictViolations(best[0].partition).length, 0);
});
