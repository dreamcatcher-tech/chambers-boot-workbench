import {
  LABELS,
  RESPONSIBILITY_NAMES,
  STAGES,
  bestCandidates,
  conflictViolations,
  generateCandidates,
  stagePass,
} from "./src/model.js";

const candidates = generateCandidates();
const policyCount = Math.max(...candidates.map((candidate) => candidate.policy.ordinal)) + 1;
const partitionCount = Math.max(...candidates.map((candidate) => candidate.partition.ordinal)) + 1;

const elements = {
  canvas: document.querySelector("#solutionMap"),
  tooltip: document.querySelector("#mapTooltip"),
  stageTrack: document.querySelector("#stageTrack"),
  play: document.querySelector("#playButton"),
  survivorCount: document.querySelector("#survivorCount"),
  topologyCount: document.querySelector("#topologyCount"),
  stageName: document.querySelector("#stageName"),
  objectiveName: document.querySelector("#objectiveName"),
  profile: document.querySelector("#profileSelect"),
  topology: document.querySelector("#topologySelect"),
  packaging: document.querySelector("#packageSelect"),
  recovery: document.querySelector("#recoverySelect"),
  relaxIsolation: document.querySelector("#relaxIsolation"),
  diagram: document.querySelector("#architectureDiagram"),
  verdict: document.querySelector("#verdict"),
  resultFormula: document.querySelector("#resultFormula"),
};

const state = {
  stage: 5,
  profile: "unified",
  topology: "any",
  packaging: "any",
  recovery: "any",
  relaxIsolation: false,
  timer: null,
  active: [],
  selected: [],
};

const number = new Intl.NumberFormat("en-US");
const profileNames = {
  unified: "UNIFIED",
  current: "CURRENT DOC",
  minimal: "MINIMUM",
  availability: "AVAILABILITY",
};

function stageOptions() {
  return {
    strictIsolation: !state.relaxIsolation,
    requireAtomic: true,
    boundFallback: true,
    wholeUpgrade: true,
  };
}

function matchesKnobs(candidate) {
  if (state.topology === "four" && candidate.partition.blocks.length !== 4) return false;
  if (state.topology === "one" && candidate.partition.blocks.length !== 1) return false;
  if (state.packaging !== "any" && candidate.policy.packaging !== state.packaging) return false;
  if (state.recovery !== "any" && candidate.policy.recovery !== state.recovery) return false;
  return true;
}

function activeCandidates() {
  const filterStage = Math.min(state.stage, 4);
  return candidates.filter((candidate) => stagePass(candidate, filterStage, stageOptions()) && matchesKnobs(candidate));
}

function buildStageTrack() {
  elements.stageTrack.innerHTML = "";
  STAGES.forEach((stage, index) => {
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = `${String(index + 1).padStart(2, "0")} ${stage.label.toUpperCase()}`;
    button.title = stage.short;
    button.addEventListener("click", () => {
      stopAnimation();
      state.stage = index;
      render();
    });
    item.append(button);
    elements.stageTrack.append(item);
  });
}

function renderStageTrack() {
  [...elements.stageTrack.children].forEach((item, index) => {
    item.classList.toggle("active", index <= state.stage);
  });
}

function drawMap() {
  const canvas = elements.canvas;
  const context = canvas.getContext("2d");
  const width = 1152;
  const height = 416;
  const cellWidth = width / policyCount;
  const cellHeight = height / partitionCount;
  const activeIds = new Set(state.active.map((candidate) => candidate.id));
  const selectedIds = new Set(state.selected.map((candidate) => candidate.id));

  context.clearRect(0, 0, width, height);
  context.fillStyle = "#050b14";
  context.fillRect(0, 0, width, height);

  for (const candidate of candidates) {
    const x = candidate.policy.ordinal * cellWidth;
    const y = candidate.partition.ordinal * cellHeight;
    const isActive = activeIds.has(candidate.id);
    const isSelected = selectedIds.has(candidate.id);

    if (isSelected) {
      context.fillStyle = "#ffbd59";
    } else if (isActive) {
      context.fillStyle = state.stage >= 4 ? "#4de5d5" : "#5b92ff";
    } else {
      context.fillStyle = "rgba(102, 126, 155, .08)";
    }
    context.fillRect(x + 0.25, y + 0.45, Math.max(1, cellWidth - 0.5), Math.max(1, cellHeight - 0.9));
  }

  if (state.selected.length) {
    context.strokeStyle = "#fff5d8";
    context.lineWidth = 1.5;
    for (const candidate of state.selected) {
      const x = candidate.policy.ordinal * cellWidth;
      const y = candidate.partition.ordinal * cellHeight;
      context.strokeRect(x - 1, y - 1, cellWidth + 2, cellHeight + 2);
    }
  }
}

function blockName(block) {
  if (block.length === 5) return "Unified control container";
  if (block.includes("A") && block.includes("R")) return "Gateway";
  return block.map((item) => RESPONSIBILITY_NAMES[item]).join(" + ");
}

function blockClass(block) {
  if (block.includes("P")) return "persistence";
  if (block.includes("A") || block.includes("R")) return "gateway";
  return "";
}

function renderArchitecture() {
  const candidate = state.selected[0] ?? state.active[0];
  if (!candidate) {
    elements.diagram.innerHTML = '<div class="package-shell"><div class="package-label">NO SURVIVING DESIGN</div></div>';
    elements.resultFormula.textContent = "∅";
    elements.verdict.className = "verdict rejected";
    elements.verdict.textContent = state.topology === "one" && !state.relaxIsolation
      ? "Rejected: one container merges the Persistence RW boundary, Engine TCB, enforcement, and lifecycle policy. Toggle “Relax capability separation” to inspect that trade."
      : "No point satisfies the current constraint and knob combination.";
    return;
  }

  const blocks = candidate.partition.blocks;
  const roleCards = blocks.map((block) => `
    <div class="role-card ${blockClass(block)}">
      <span>${block.join(" + ")}</span>
      <strong>${blockName(block)}</strong>
      <small>${block.map((item) => RESPONSIBILITY_NAMES[item]).join(" · ")}</small>
    </div>`).join("");

  elements.diagram.innerHTML = `
    <div class="package-shell">
      <div class="package-label">K · ${LABELS.packaging[candidate.policy.packaging].toUpperCase()}</div>
      <div class="role-row" style="--role-count:${Math.min(blocks.length, 5)}">${roleCards}</div>
      <div class="boot-order"><span>BOOT</span><b>${LABELS.boot[candidate.policy.boot]}</b></div>
    </div>
    <div class="recovery-brace">Γ · ${LABELS.recovery[candidate.policy.recovery].toUpperCase()}</div>`;

  const packageCount = candidate.policy.packaging === "shared_image" ? "1 image" : candidate.policy.packaging === "bundle_index" ? "1 index" : "4 images";
  const recoveryCount = candidate.policy.recovery === "group" ? 1 : blocks.length;
  elements.resultFormula.textContent = `|K|=${packageCount} · |Π|=${blocks.length} · |Γ|=${recoveryCount}`;

  const violations = conflictViolations(candidate.partition);
  if (violations.length) {
    elements.verdict.className = "verdict rejected";
    elements.verdict.textContent = `Explorable only with relaxed isolation: ${violations.length} authority conflict${violations.length === 1 ? "" : "s"} are co-located. Mechanical simplicity is bought by widening the trusted and writable boundary.`;
  } else if (candidate.policy.packaging === "shared_image") {
    elements.verdict.className = "verdict";
    elements.verdict.textContent = "Feasible: one immutable image can launch four role-scoped containers. ProcMan still restarts them as one group; only Persistence receives the RW volume.";
  } else {
    elements.verdict.className = "verdict";
    elements.verdict.textContent = "Recommended: one selected OCI index binds four role images; ProcMan launches four isolated Chambers and applies one group recovery policy.";
  }
}

function render() {
  state.active = activeCandidates();
  state.selected = bestCandidates(state.active, state.profile);
  if (state.stage < 5) state.selected = [];

  const topologies = new Set(state.active.map((candidate) => candidate.partition.key));
  elements.survivorCount.textContent = number.format(state.active.length);
  elements.topologyCount.textContent = number.format(topologies.size);
  elements.stageName.textContent = STAGES[state.stage].label.toUpperCase();
  elements.objectiveName.textContent = profileNames[state.profile];
  renderStageTrack();
  drawMap();
  renderArchitecture();
}

function stopAnimation() {
  if (state.timer) window.clearInterval(state.timer);
  state.timer = null;
  elements.play.classList.remove("playing");
  elements.play.innerHTML = "<span>▶</span> PLAY CONVERGENCE";
}

function playAnimation() {
  stopAnimation();
  state.stage = 0;
  render();
  elements.play.classList.add("playing");
  elements.play.innerHTML = "<span>■</span> STOP";
  state.timer = window.setInterval(() => {
    if (state.stage >= 5) {
      stopAnimation();
      return;
    }
    state.stage += 1;
    render();
  }, 760);
}

elements.play.addEventListener("click", () => {
  if (state.timer) stopAnimation(); else playAnimation();
});

elements.profile.addEventListener("change", (event) => {
  state.profile = event.target.value;
  state.stage = 5;
  render();
});
elements.topology.addEventListener("change", (event) => {
  state.topology = event.target.value;
  state.stage = 5;
  render();
});
elements.packaging.addEventListener("change", (event) => {
  state.packaging = event.target.value;
  state.stage = 5;
  render();
});
elements.recovery.addEventListener("change", (event) => {
  state.recovery = event.target.value;
  state.stage = 5;
  render();
});
elements.relaxIsolation.addEventListener("change", (event) => {
  state.relaxIsolation = event.target.checked;
  state.stage = 5;
  render();
});

elements.canvas.addEventListener("mousemove", (event) => {
  const rect = elements.canvas.getBoundingClientRect();
  const x = (event.clientX - rect.left) / rect.width * 1152;
  const y = (event.clientY - rect.top) / rect.height * 416;
  const policyOrdinal = Math.max(0, Math.min(policyCount - 1, Math.floor(x / (1152 / policyCount))));
  const partitionOrdinal = Math.max(0, Math.min(partitionCount - 1, Math.floor(y / (416 / partitionCount))));
  const candidate = candidates[partitionOrdinal * policyCount + policyOrdinal];
  if (!candidate) return;
  const survives = state.active.some((active) => active.id === candidate.id);
  elements.tooltip.hidden = false;
  elements.tooltip.style.left = `${Math.min(event.offsetX + 14, rect.width - 276)}px`;
  elements.tooltip.style.top = `${Math.max(4, event.offsetY - 68)}px`;
  elements.tooltip.innerHTML = `<b>${survives ? "SURVIVES" : "FILTERED"}</b><br>${candidate.partition.key}<br>${LABELS.boot[candidate.policy.boot]} · ${LABELS.recovery[candidate.policy.recovery]}<br>${LABELS.packaging[candidate.policy.packaging]}`;
});
elements.canvas.addEventListener("mouseleave", () => { elements.tooltip.hidden = true; });

buildStageTrack();
render();
