# Chambers Boot-set Workbench

Interactive GitHub Pages workbench for the bounded Chambers boot-architecture design space.

**Live:** <https://dreamcatcher-tech.github.io/chambers-boot-workbench/>

## Model

The v2 grammar separates three partitions that are often accidentally collapsed:

- **K — packaging:** which binaries/images are selected together;
- **Π — isolation:** which responsibilities share a capability boundary;
- **Γ — recovery:** which running members restart together.

It exhaustively enumerates:

```text
52 responsibility partitions
× 576 lifecycle/package policies
= 29,952 bounded designs
```

Default hard constraints reduce the map:

```text
29,952 → 1,152 → 576 → 384 → 192
```

A declared lexicographic objective then selects one point. The default unified-restart profile produces:

```text
one OCI Boot-set index
four isolated Chambers: Engine | Persistence | Gateway(A+R) | Supervisor
one group restart fate
one-use, pre-admission, compatibility-qualified LKG fallback
```

## Run

```bash
npm test
npm run serve
```

Open <http://localhost:4173>.

No build step or runtime dependency is required.
