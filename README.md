# Chambers Ark Core Workbench

Interactive GitHub Pages workbench for the bounded Chambers core-architecture design space.

Live site: <https://dreamcatcher-tech.github.io/chambers-boot-workbench/>

## Authority boundary

This workbench is a bounded structural-synthesis and sensitivity artifact. It records design provenance and explains why one candidate was selected; it is not the current authority for modeled Chambers semantics. The governing agreement is the exact ratified release in [`dreamcatcher-tech/chambers-temporal-model`](https://github.com/dreamcatcher-tech/chambers-temporal-model), currently [`chambers-formal-specification/v1.2.0`](https://github.com/dreamcatcher-tech/chambers-temporal-model/releases/tag/formal-spec-v1.2.0) / `formal-spec-v1.2.0`. A change explored here becomes authoritative only if accepted into a later formal release with an explicit changelog delta and checker evidence.

## Model

The deterministic browser model enumerates:

- all 52 set partitions of `E, A, R, P, S`;
- 576 lifecycle policies across boot order, selector, writer, fallback, upgrade, recovery, release, and packaging; and
- 29,952 bounded candidates in total.

The V3 correction separates **problem invariants** from cross-role sandbox edges inherited from an earlier candidate.
The profile later incorporated into the formal specification requires one selected Ark Core appliance, fixed required-role startup, aggregate readiness, one upgrade fate, and one crash fate. It produces:

```text
one Ark Core OCI image
one gVisor task
required Engine / Persistence / Gateway / Supervisor roles
one whole-appliance recovery fate
```

or:

```text
|K| = 1, |Π| = 1, |Γ| = 1
```

The formal release does **not** specify Engine PID placement, the concrete in-image restarter, dual Worker Manager listeners, or a quantified production-security acceptance. Those are downstream embodiment choices or bounded runtime/design provenance.

The v1.2.0 successor also governs bounded ordinary Git remote-synchronization outcomes—exact fetch retention, durable intent, scoped authority, fast-forward expected-head compare-and-swap, explicit conflict, readback-before-confirm-or-retry, same-operation recovery, retained evidence, and no implicit runtime promotion. Those distributed-state outcomes are outside this structural partition workbench's candidate grammar; this workbench neither visualizes nor overrides the `GitRemoteSynchronization` kernel.

The strict-isolation sensitivity profile re-promotes the nine cross-role defense-in-depth edges and recovers the former four-boundary answer. That profile remains a non-authoritative counterfactual unless promoted through a later formal release. The workbench's nine-edge exposure score is sensitivity analysis, not a formal-release claim that a particular production risk was accepted. Ordinary Chambers and sibling Ark scopes remain separately isolated.

## Run checks

```bash
npm test
node --check app.js
node --check src/model.js
git diff --check
```

The site has no runtime dependencies and is served directly from the repository root by GitHub Pages.
