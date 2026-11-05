# Yara Context Index

This file is the canonical map for Yara product, design, technical, and delivery context. It tells humans and coding agents what to read and how to resolve conflicts. It does not replace or summarize away the source documents.

## Authority order

1. **Technical architecture:** [`technical/Yara-Technical-Design.md`](technical/Yara-Technical-Design.md) and Accepted ADRs under [`technical/adr/`](technical/adr/).
2. **Product semantics:** [`product/YARA_MASTER_CONTEXT.md`](product/YARA_MASTER_CONTEXT.md), [`product/DECISIONS.md`](product/DECISIONS.md), and frozen files under [`product/baselines/`](product/baselines/).
3. **Delivery status:** root [`../PLANS.md`](../PLANS.md).
4. **Agent operating rules:** root [`../AGENTS.md`](../AGENTS.md).
5. **Execution and reference material:** `design/`, `reference/`, and `project/` support implementation and historical review but never override canonical Product or Technical sources.

If two sources at different levels conflict, the higher-authority source wins within its subject area. If two canonical sources appear to conflict, stop the affected work and report the exact Product, Design, or Architecture blocker; do not silently reconcile it in code.

## Document map

| Area                       | Canonical location                                                         | Purpose                                                          | Authority                     |
| -------------------------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------- | ----------------------------- |
| Product master context     | [`product/YARA_MASTER_CONTEXT.md`](product/YARA_MASTER_CONTEXT.md)         | Stable product definition and non-negotiable semantics           | Canonical Product source      |
| Product decisions          | [`product/DECISIONS.md`](product/DECISIONS.md)                             | Explicit approved product decisions                              | Canonical Product source      |
| Product baselines          | [`product/baselines/`](product/baselines/)                                 | Architecture, pages, navigation, flows, low-fi, and Signature UI | Frozen Product source         |
| Technical Design           | [`technical/Yara-Technical-Design.md`](technical/Yara-Technical-Design.md) | Approved system and implementation architecture                  | Canonical Architecture source |
| ADRs                       | [`technical/adr/`](technical/adr/)                                         | Durable architecture decisions and status                        | Canonical when Accepted       |
| Technical TOC              | [`technical/TECHNICAL_DESIGN_TOC.md`](technical/TECHNICAL_DESIGN_TOC.md)   | Authoritative chapter structure                                  | Structural source             |
| Design execution           | [`design/execution/`](design/execution/)                                   | High-fi execution and freeze evidence                            | Supporting evidence           |
| Design assets              | [`design/assets/`](design/assets/)                                         | Generated and approved design assets                             | Supporting asset              |
| Project compatibility task | [`project/CURRENT_TASK.md`](project/CURRENT_TASK.md)                       | Legacy task pointer; current delivery state lives in `PLANS.md`  | Non-canonical pointer         |
| References                 | [`reference/`](reference/)                                                 | Source index and supporting references                           | Non-authoritative reference   |

## Product baseline inventory

Read all seven files when a task can affect product architecture, navigation, page responsibility, flows, or Signature UI:

1. [`product/baselines/01_ARCHITECTURE_BASELINE.md`](product/baselines/01_ARCHITECTURE_BASELINE.md)
2. [`product/baselines/02_PAGE_ARCHITECTURE.md`](product/baselines/02_PAGE_ARCHITECTURE.md)
3. [`product/baselines/03_NAVIGATION_SPEC.md`](product/baselines/03_NAVIGATION_SPEC.md)
4. [`product/baselines/04_USER_FLOWS.md`](product/baselines/04_USER_FLOWS.md)
5. [`product/baselines/05_BUSINESS_FLOWS.md`](product/baselines/05_BUSINESS_FLOWS.md)
6. [`product/baselines/06_LOWFI_SPEC.md`](product/baselines/06_LOWFI_SPEC.md)
7. [`product/baselines/07_SIGNATURE_UI.md`](product/baselines/07_SIGNATURE_UI.md)

## Context-loading profiles

### Every implementation task

Read:

1. root `AGENTS.md`;
2. root `PLANS.md`;
3. this index;
4. the relevant Technical Design chapters and Accepted ADRs;
5. relevant Product sources when behavior or semantics may be affected.

### Product, UI, or user-flow task

Also read:

- `product/YARA_MASTER_CONTEXT.md`;
- `product/DECISIONS.md`;
- all relevant files in `product/baselines/`;
- `design/execution/` only for approved execution/freeze evidence.

### Architecture or backend task

Also read:

- relevant chapters in `technical/Yara-Technical-Design.md`;
- every Accepted ADR referenced by those chapters;
- Product sources only to the extent necessary to preserve product semantics.

### Status, continuation, or handoff task

Read root `PLANS.md` first. `project/CURRENT_TASK.md` exists only for compatibility with older workflows and must not supersede `PLANS.md`.

## Conflict rules

- Product sources define what Yara is and how approved product behavior works.
- Technical Design and Accepted ADRs define how the frozen product is implemented.
- `PLANS.md` records what has been implemented and verified; it cannot create architecture.
- Design execution and reference artifacts provide evidence and history; they cannot override Product or Technical authority.
- Generated code, tests, schemas, README files, and deployment files must conform to canonical sources, not redefine them.

## Legacy-path compatibility

Older prompts may still name root paths. The repository retains symlinks so those prompts resolve to the canonical documents without duplicate content:

| Legacy root path         | Canonical target                      |
| ------------------------ | ------------------------------------- |
| `YARA_MASTER_CONTEXT.md` | `docs/product/YARA_MASTER_CONTEXT.md` |
| `DECISIONS.md`           | `docs/product/DECISIONS.md`           |
| `CURRENT_TASK.md`        | `docs/project/CURRENT_TASK.md`        |
| `baselines/`             | `docs/product/baselines/`             |
| `execution/`             | `docs/design/execution/`              |
| `assets/`                | `docs/design/assets/`                 |
| `reference/`             | `docs/reference/`                     |

These aliases are compatibility entry points only. Edit the canonical target under `docs/`; never replace a symlink with a second copy.

## Integrity verification

Run:

```bash
pnpm check:context
```

The check fails if a canonical source is missing or empty, the seven-file Product baseline inventory changes unexpectedly, or a legacy alias stops resolving to its canonical target. The full `pnpm verify` gate includes this check.
