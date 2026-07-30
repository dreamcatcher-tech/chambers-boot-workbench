# Chambers Ark Core Workbench

Interactive GitHub Pages workbench for the bounded Chambers core-architecture design space.

Live site: <https://dreamcatcher-tech.github.io/chambers-boot-workbench/>

## Authority boundary

This workbench is a bounded structural-synthesis and sensitivity artifact. It records design provenance and explains why one candidate was selected; it is not the current authority for modeled Chambers semantics. The governing agreement is the exact ratified release in [`dreamcatcher-tech/chambers-temporal-model`](https://github.com/dreamcatcher-tech/chambers-temporal-model), currently `chambers-formal-specification/v1.0.1` / `formal-spec-v1.0.1`. A change explored here becomes authoritative only if accepted into a later formal release with an explicit changelog delta and checker evidence.

## Model

The deterministic browser model enumerates:

- all 52 set partitions of `E, A, R, P, S`;
- 576 lifecycle policies across boot order, selector, writer, fallback, upgrade, recovery, release, and packaging; and
- 29,952 bounded candidates in total.

The V3 correction separates **problem invariants** from cross-role sandbox edges inherited from an earlier candidate.
The profile later incorporated into the formal specification requires one atomic selector, bounded fallback, one upgrade fate, and one crash fate, then minimizes host-root task/orchestration semantics. It produces:

```text
one Ark Core OCI image
one gVisor task
III Engine PID 1 + required Persistence / Gateway / Supervisor workers
one whole-appliance recovery fate
```

or:

```text
|K| = 1, |Π| = 1, |Γ| = 1
```

The strict-isolation sensitivity profile re-promotes the nine cross-role defense-in-depth edges and recovers the
former four-boundary answer. That profile remains a non-authoritative counterfactual unless promoted through a later formal release.

The residual risk accepted by the governing formal release is explicit: container-root compromise inside the Ark Core can reach Persistence's
mounted data. The compensating gain is a smaller, less semantic host-root ProcMan and a larger independently
upgradable Core domain. Ordinary Chambers and sibling Ark scopes remain separately isolated.

## Run checks

```bash
npm test
node --check app.js
node --check src/model.js
git diff --check
```

The site has no runtime dependencies and is served directly from the repository root by GitHub Pages.
