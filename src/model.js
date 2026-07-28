export const RESPONSIBILITIES = ["E", "A", "R", "P", "S"];

export const RESPONSIBILITY_NAMES = {
  E: "Engine",
  A: "Admission",
  R: "Routing",
  P: "Persistence",
  S: "Supervisor",
};

// These are defense-in-depth edges, not universal feasibility constraints.
// The accepted Ark Core profile prices their co-location as residual risk;
// the strict-isolation sensitivity profile promotes them back to hard edges.
export const CORE_ISOLATION_EDGES = [
  ["E", "A"], ["E", "R"], ["E", "P"], ["E", "S"],
  ["P", "A"], ["P", "R"], ["P", "S"],
  ["S", "A"], ["S", "R"],
];

export const AXES = {
  boot: ["persistence_first", "gateway_first"],
  selector: ["atomic", "independent"],
  writer: ["persistence", "host_agent"],
  fallback: ["bounded_lkg", "manual_only", "unbounded_auto"],
  upgrade: ["whole_set", "member_live"],
  recovery: ["group", "member"],
  release: ["child_scope", "in_place"],
  packaging: ["shared_image", "bundle_index", "separate_images"],
};

export const STAGES = [
  { id: "map", label: "Map", short: "Every bounded point" },
  { id: "select", label: "Select", short: "One atomic coordinate" },
  { id: "recover", label: "Recover", short: "No unbounded rollback" },
  { id: "couple", label: "Share fate", short: "One upgrade and crash fate" },
  { id: "rebalance", label: "Rebalance", short: "Audit the inherited isolation edge" },
  { id: "optimize", label: "Optimize", short: "Minimize host-root semantics" },
];

export function generatePartitions(items = RESPONSIBILITIES) {
  let partitions = [[]];
  for (const item of items) {
    const next = [];
    for (const partition of partitions) {
      for (let i = 0; i < partition.length; i += 1) {
        const clone = partition.map((block) => [...block]);
        clone[i].push(item);
        next.push(clone);
      }
      next.push([...partition.map((block) => [...block]), [item]]);
    }
    partitions = next;
  }
  return partitions.map((partition, ordinal) => ({
    blocks: partition,
    ordinal,
    key: partition.map((block) => block.join("+")).join(" | "),
  }));
}

function cartesianAxes(axes) {
  let rows = [{}];
  for (const [name, values] of Object.entries(axes)) {
    rows = rows.flatMap((row) => values.map((value) => ({ ...row, [name]: value })));
  }
  return rows;
}

export function generatePolicies() {
  return cartesianAxes(AXES).map((policy, ordinal) => ({ ...policy, ordinal }));
}

export function conflictViolations(partition) {
  const blockOf = new Map();
  partition.blocks.forEach((block, blockIndex) => {
    block.forEach((item) => blockOf.set(item, blockIndex));
  });
  return CORE_ISOLATION_EDGES.filter(([left, right]) => blockOf.get(left) === blockOf.get(right));
}

export function hasGatewayPair(partition) {
  return partition.blocks.some((block) => block.includes("A") && block.includes("R"));
}

export function hostRootSemanticCost(partition) {
  // One opaque Core task costs one launch/recovery unit. Every additional
  // boundary adds another task plus a host-owned dependency edge.
  const tasks = partition.blocks.length;
  const orchestrationEdges = Math.max(0, tasks - 1);
  return tasks + orchestrationEdges;
}

export function generateCandidates() {
  const partitions = generatePartitions();
  const policies = generatePolicies();
  const candidates = [];
  for (const partition of partitions) {
    for (const policy of policies) {
      candidates.push({
        id: candidates.length,
        partition,
        policy,
      });
    }
  }
  return candidates;
}

export function stagePass(candidate, stage, options = {}) {
  const {
    strictIsolation = false,
    requireAtomic = true,
    boundFallback = true,
    wholeUpgrade = true,
    requireGroupRecovery = true,
  } = options;

  if (stage >= 1 && requireAtomic && candidate.policy.selector !== "atomic") return false;
  if (stage >= 2 && boundFallback && candidate.policy.fallback === "unbounded_auto") return false;
  if (stage >= 3 && wholeUpgrade && candidate.policy.upgrade !== "whole_set") return false;
  if (stage >= 3 && requireGroupRecovery && candidate.policy.recovery !== "group") return false;
  if (stage >= 4 && strictIsolation && conflictViolations(candidate.partition).length > 0) return false;
  return true;
}

const preference = (actual, expected) => (actual === expected ? 0 : 1);
const order = (actual, values) => values.indexOf(actual);

export function scoreCandidate(candidate, profile = "ark_core") {
  const p = candidate.policy;
  const exposure = conflictViolations(candidate.partition).length;
  const rootCost = hostRootSemanticCost(candidate.partition);
  const gatewaySplit = hasGatewayPair(candidate.partition) ? 0 : 1;

  const topologyProfiles = {
    ark_core: [rootCost, exposure, gatewaySplit],
    strict: [exposure, rootCost, gatewaySplit],
    minimal: [rootCost, gatewaySplit, exposure],
    availability: [exposure, rootCost, gatewaySplit],
  };

  const policyProfiles = {
    ark_core: [
      preference(p.boot, "persistence_first"),
      preference(p.writer, "persistence"),
      order(p.fallback, ["bounded_lkg", "manual_only", "unbounded_auto"]),
      preference(p.recovery, "group"),
      preference(p.release, "child_scope"),
      order(p.packaging, ["shared_image", "bundle_index", "separate_images"]),
    ],
    strict: [
      preference(p.boot, "persistence_first"),
      preference(p.writer, "persistence"),
      order(p.fallback, ["bounded_lkg", "manual_only", "unbounded_auto"]),
      preference(p.recovery, "group"),
      preference(p.release, "child_scope"),
      order(p.packaging, ["bundle_index", "separate_images", "shared_image"]),
    ],
    minimal: [
      preference(p.boot, "gateway_first"),
      preference(p.writer, "host_agent"),
      order(p.fallback, ["manual_only", "bounded_lkg", "unbounded_auto"]),
      preference(p.recovery, "group"),
      preference(p.release, "child_scope"),
      order(p.packaging, ["shared_image", "bundle_index", "separate_images"]),
    ],
    availability: [
      preference(p.boot, "persistence_first"),
      preference(p.writer, "persistence"),
      order(p.fallback, ["bounded_lkg", "manual_only", "unbounded_auto"]),
      preference(p.recovery, "member"),
      preference(p.release, "child_scope"),
      order(p.packaging, ["bundle_index", "separate_images", "shared_image"]),
    ],
  };

  return [
    ...(topologyProfiles[profile] ?? topologyProfiles.ark_core),
    ...(policyProfiles[profile] ?? policyProfiles.ark_core),
  ];
}

export function compareScores(left, right) {
  const length = Math.max(left.length, right.length);
  for (let i = 0; i < length; i += 1) {
    const delta = (left[i] ?? 0) - (right[i] ?? 0);
    if (delta !== 0) return delta;
  }
  return 0;
}

export function bestCandidates(candidates, profile = "ark_core") {
  if (candidates.length === 0) return [];
  let bestScore = scoreCandidate(candidates[0], profile);
  let best = [candidates[0]];
  for (let i = 1; i < candidates.length; i += 1) {
    const score = scoreCandidate(candidates[i], profile);
    const comparison = compareScores(score, bestScore);
    if (comparison < 0) {
      bestScore = score;
      best = [candidates[i]];
    } else if (comparison === 0) {
      best.push(candidates[i]);
    }
  }
  return best;
}

export function stageCounts(candidates, options = {}) {
  return STAGES.map((_, stage) => candidates.filter((candidate) => stagePass(candidate, stage, options)).length);
}

export const LABELS = {
  boot: {
    persistence_first: "Engine → Persistence → Gateway → Supervisor",
    gateway_first: "Engine → Gateway₀ → Persistence → Supervisor → Gateway₁",
  },
  writer: {
    persistence: "Persistence commits",
    host_agent: "Host Agent commits",
  },
  fallback: {
    bounded_lkg: "one-use pre-admission LKG",
    manual_only: "explicit recovery",
    unbounded_auto: "unbounded automatic rollback",
  },
  recovery: {
    group: "restart whole appliance",
    member: "repair failed member",
  },
  release: {
    child_scope: "rehearsed child Ark scope",
    in_place: "in-place replacement",
  },
  packaging: {
    shared_image: "one Ark Core image",
    bundle_index: "one OCI index · role images",
    separate_images: "independently packaged role images",
  },
};
