export const RESPONSIBILITIES = ["E", "A", "R", "P", "S"];

export const RESPONSIBILITY_NAMES = {
  E: "Engine",
  A: "Admission",
  R: "Routing",
  P: "Persistence",
  S: "Supervisor",
};

export const CONFLICTS = [
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
  release: ["replacement_host", "in_place"],
  packaging: ["bundle_index", "shared_image", "separate_images"],
};

export const STAGES = [
  { id: "map", label: "Map", short: "Every bounded point" },
  { id: "isolate", label: "Isolate", short: "Separate conflicting authority" },
  { id: "select", label: "Select", short: "One atomic coordinate" },
  { id: "recover", label: "Recover", short: "No unbounded rollback" },
  { id: "upgrade", label: "Upgrade", short: "One Boot-set upgrade fate" },
  { id: "optimize", label: "Optimize", short: "Apply declared objective" },
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
  return CONFLICTS.filter(([left, right]) => blockOf.get(left) === blockOf.get(right));
}

export function hasGatewayPair(partition) {
  return partition.blocks.some((block) => block.includes("A") && block.includes("R"));
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
    strictIsolation = true,
    requireAtomic = true,
    boundFallback = true,
    wholeUpgrade = true,
  } = options;

  if (stage >= 1 && strictIsolation && conflictViolations(candidate.partition).length > 0) return false;
  if (stage >= 2 && requireAtomic && candidate.policy.selector !== "atomic") return false;
  if (stage >= 3 && boundFallback && candidate.policy.fallback === "unbounded_auto") return false;
  if (stage >= 4 && wholeUpgrade && candidate.policy.upgrade !== "whole_set") return false;
  return true;
}

const preference = (actual, expected) => (actual === expected ? 0 : 1);
const order = (actual, values) => values.indexOf(actual);

export function scoreCandidate(candidate, profile = "unified") {
  const p = candidate.policy;
  const common = [
    candidate.partition.blocks.length,
    hasGatewayPair(candidate.partition) ? 0 : 1,
  ];

  const profiles = {
    unified: [
      preference(p.boot, "persistence_first"),
      preference(p.writer, "persistence"),
      order(p.fallback, ["bounded_lkg", "manual_only", "unbounded_auto"]),
      preference(p.recovery, "group"),
      preference(p.release, "replacement_host"),
      order(p.packaging, ["bundle_index", "shared_image", "separate_images"]),
    ],
    current: [
      preference(p.boot, "persistence_first"),
      preference(p.writer, "persistence"),
      order(p.fallback, ["bounded_lkg", "manual_only", "unbounded_auto"]),
      preference(p.recovery, "member"),
      preference(p.release, "replacement_host"),
      order(p.packaging, ["bundle_index", "separate_images", "shared_image"]),
    ],
    minimal: [
      preference(p.boot, "gateway_first"),
      preference(p.writer, "host_agent"),
      order(p.fallback, ["manual_only", "bounded_lkg", "unbounded_auto"]),
      preference(p.recovery, "group"),
      preference(p.release, "replacement_host"),
      order(p.packaging, ["bundle_index", "shared_image", "separate_images"]),
    ],
    availability: [
      preference(p.boot, "persistence_first"),
      preference(p.writer, "persistence"),
      order(p.fallback, ["bounded_lkg", "manual_only", "unbounded_auto"]),
      preference(p.recovery, "member"),
      preference(p.release, "replacement_host"),
      order(p.packaging, ["bundle_index", "separate_images", "shared_image"]),
    ],
  };

  return [...common, ...(profiles[profile] ?? profiles.unified)];
}

export function compareScores(left, right) {
  const length = Math.max(left.length, right.length);
  for (let i = 0; i < length; i += 1) {
    const delta = (left[i] ?? 0) - (right[i] ?? 0);
    if (delta !== 0) return delta;
  }
  return 0;
}

export function bestCandidates(candidates, profile = "unified") {
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
  return STAGES.map((_, stage) => {
    const filterStage = Math.min(stage, 4);
    return candidates.filter((candidate) => stagePass(candidate, filterStage, options)).length;
  });
}

export const LABELS = {
  boot: {
    persistence_first: "E → P → G → S",
    gateway_first: "E → G₀ → P → S → G₁",
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
    group: "restart complete set",
    member: "repair failed member",
  },
  release: {
    replacement_host: "rehearsed replacement host",
    in_place: "in-place replacement",
  },
  packaging: {
    bundle_index: "one OCI index · four role images",
    shared_image: "one shared image · four role tasks",
    separate_images: "four independently packaged images",
  },
};
