import test from "node:test";
import assert from "node:assert/strict";

import {
  bestCandidates,
  conflictViolations,
  generateCandidates,
  generatePartitions,
  generatePolicies,
  hasGatewayPair,
  stageCounts,
  stagePass,
} from "../src/model.js";

const candidates = generateCandidates();

test("the v2 grammar is exhaustively enumerated", () => {
  assert.equal(generatePartitions().length, 52);
  assert.equal(generatePolicies().length, 576);
  assert.equal(candidates.length, 29_952);
  assert.deepEqual(stageCounts(candidates).slice(0, 5), [29_952, 1_152, 576, 384, 192]);
});

test("strict authority separation leaves exactly two static partitions", () => {
  const partitions = generatePartitions().filter((partition) => conflictViolations(partition).length === 0);
  assert.equal(partitions.length, 2);
  assert.deepEqual(partitions.map((partition) => partition.blocks.length).sort(), [4, 5]);
  const minimum = partitions.find((partition) => partition.blocks.length === 4);
  assert.ok(minimum);
  assert.equal(hasGatewayPair(minimum), true);
});

test("one container is rejected while one shared image across four containers is feasible", () => {
  const oneContainer = candidates.find((candidate) => candidate.partition.blocks.length === 1);
  assert.ok(oneContainer);
  assert.equal(stagePass(oneContainer, 1), false);

  const sharedImage = candidates.find((candidate) =>
    candidate.partition.blocks.length === 4
    && conflictViolations(candidate.partition).length === 0
    && candidate.policy.selector === "atomic"
    && candidate.policy.fallback === "bounded_lkg"
    && candidate.policy.upgrade === "whole_set"
    && candidate.policy.packaging === "shared_image"
  );
  assert.ok(sharedImage);
  assert.equal(stagePass(sharedImage, 4), true);
});

test("the unified-restart objective has one deterministic optimum", () => {
  const feasible = candidates.filter((candidate) => stagePass(candidate, 4));
  const best = bestCandidates(feasible, "unified");
  assert.equal(best.length, 1);
  assert.equal(best[0].partition.blocks.length, 4);
  assert.equal(hasGatewayPair(best[0].partition), true);
  assert.equal(best[0].policy.boot, "persistence_first");
  assert.equal(best[0].policy.writer, "persistence");
  assert.equal(best[0].policy.fallback, "bounded_lkg");
  assert.equal(best[0].policy.recovery, "group");
  assert.equal(best[0].policy.packaging, "bundle_index");
});

test("the current-document profile differs only at same-selection recovery", () => {
  const feasible = candidates.filter((candidate) => stagePass(candidate, 4));
  const unified = bestCandidates(feasible, "unified")[0];
  const current = bestCandidates(feasible, "current")[0];
  assert.equal(unified.partition.key, current.partition.key);
  assert.equal(unified.policy.boot, current.policy.boot);
  assert.equal(unified.policy.fallback, current.policy.fallback);
  assert.equal(unified.policy.recovery, "group");
  assert.equal(current.policy.recovery, "member");
});
