# Yara MVP-0 Implementation Plan

This file tracks implementation progress. It does not create or modify architecture decisions; `docs/technical/Yara-Technical-Design.md` and Accepted ADRs remain canonical.

## Roadmap

| Stage | Scope                                                                                     | Status                                     |
| ----- | ----------------------------------------------------------------------------------------- | ------------------------------------------ |
| 0     | Repository foundation: monorepo boundaries, contracts, local PostgreSQL/Compose, CI smoke | **ACCEPTED**                               |
| 1     | Identity, Catalog, canonical mapping, Search, Detail, UI                                  | **IN PROGRESS** — Tasks 1.1–1.3.2 accepted |
| 2     | Yara Conversation, Task/Run separation, SSE, model adapter                                | Not started                                |
| 3     | Knowledge, Hybrid Retrieval, Evidence Package, citations                                  | Not started                                |
| 4     | Typed Tools, StructuredResult lifecycle, clarification, idempotent save                   | Not started                                |
| 5     | Collection, explicit Taste, grounded Recommendation                                       | Not started                                |
| 6     | Bounded Memory, Why This, Edit, Forget propagation                                        | Not started                                |
| 7     | Evaluation, security, privacy, reliability hard gates                                     | Not started                                |
| 8     | Staging, canary, migration/restore rehearsal, operational evidence                        | Not started                                |

## Current stage

**Stage 1 — Identity + Catalog + Search + Detail UI**

## Current task

**Task 1.3.2 — Catalog Semantic Correction + Stage 1 Metadata Extension** is implemented, verified, and accepted. Stop; do not begin Task 1.3.5 automatically.

## Completed tasks

- Pre-Implementation Consistency Check approved: `APPROVED — Ready for MVP-0 Implementation`.
- Frozen implementation rules distilled into `AGENTS.md`.
- Existing repository inspected; no pre-existing Yara application/workspace implementation was present.
- pnpm TypeScript monorepo and Node 24 runtime declarations created.
- `apps/web`, `apps/api`, and `apps/worker` build and start successfully.
- Framework-free Application/AI/domain owner boundaries and architecture import check created.
- Typed Zod configuration, Kysely/PostgreSQL adapter, pg_trgm/pgvector migration, health probes, and OpenAPI baseline created.
- Docker Compose, pinned Node/PostgreSQL-pgvector images, non-root app containers, and GitHub Actions baseline created.
- Frozen quality gate (`pnpm verify`) passed on the available local Node 22 runtime; CI is configured for the canonical Node 24.22.2 runtime.
- Docker builds now share one cached dependency/build base instead of running a separate full `pnpm install` for API, Worker, and Web.
- Docker Compose started successfully on the canonical Node 24.22.2 runtime; PostgreSQL 18.6, `pg_trgm`, pgvector, API, Worker, and Web were verified locally.
- Canonical Product, Design, Reference, and Project context was safely organized under `docs/`; legacy paths remain read-compatible symlinks, and an automated context-integrity gate now protects the document map.
- Stage 0 was explicitly accepted after local runtime verification.
- Added stable Ant Design and App Router SSR style integration through `AntdRegistry` and `ConfigProvider` in `apps/web` only.
- Added a unified Web provider boundary with a per-browser `QueryClient`; Zustand was intentionally not added because Task 1.1 has no bounded cross-component client state that requires it.
- Added Yara Web tokens and Ant theme mapping based on the approved Figma visual system: Inter-led typography, warm neutral surfaces, orange active accent, restrained borders, rounded cards, and an 8-point spacing rhythm.
- Added reusable loading, error, empty, and service-status primitives plus a responsive Yara development shell.
- Added typed public/internal Web API configuration and a narrow Web health proxy for `live` and `ready` probes; no Catalog, Search, AI, or canonical mutation logic was introduced.
- Added a local standalone launcher that copies generated Next static/public assets into the standalone tree before startup, matching the Docker runtime layout and preventing missing client chunks.
- Task 1.1 — Web UI Foundation + Ant Design was explicitly accepted after local manual verification.
- Added framework-free `Artist`, MVP-0 Catalog `Release`, and `Recording` models with opaque typed IDs, closed typed references, immutable factories, canonical text validation, and duplicate structural-reference protection.
- Added explicit typed provider identity and auditable `ProviderMapping` lifecycle semantics. Provider IDs remain distinct from Yara canonical IDs, and object-type mismatches or malformed mappings are rejected.
- Added the minimal Application-facing `CatalogQueryPort` for canonical Artist/Release/Recording lookup and provider-identity resolution; no adapter or persistence contract was introduced.
- Strengthened the architecture gate so Domain packages also reject Fastify, React, Ant Design, and additional PostgreSQL driver imports.
- Task 1.2 — Catalog Domain Foundation was explicitly accepted after review.
- Added an owner-separated `catalog` PostgreSQL schema with typed Kysely row models for canonical Artist/Release/Recording, ordered structural relations, ProviderMapping lifecycle, provenance, versions, and typed candidates.
- Preserved the executed `0001_stage_zero_extensions` migration and added `0002_catalog_foundation` with foreign keys, uniqueness, state/ref checks, and deferred candidate-cardinality enforcement.
- Implemented `PostgresCatalogQueryAdapter` for the existing `CatalogQueryPort`; Kysely rows remain adapter-local and are revalidated through Domain factories. API composition root binds the concrete adapter without Application importing infrastructure.
- Added a production-guarded, deterministic Catalog fixture reset/reseed containing three Artists, four Releases, seven Recordings, ordered relations, and all seven ProviderMapping states.
- Added isolated PostgreSQL migration/repository/invariant integration tests and CI execution. Task 1.3 host quality gates, real PostgreSQL queries, Node 24 container migration, fixture load, and runtime health checks passed.
- Task 1.3 — Catalog Persistence + Fixtures was explicitly accepted.
- Task 1.3.1 — Figma-driven Catalog Data Modeling Review completed without implementation changes.
- Corrected the Catalog canonical model from `Release` to `Album`; Physical `Release / Edition / Pressing` remain unimplemented and outside Catalog ownership.
- Added minimal Figma-driven metadata only: Artist image, Album original publication year/cover, and Recording duration, each with bounded validation and persistence provenance.
- Separated provider `externalObjectType` from Yara `canonicalKind`; a provider `release-group` can now map to canonical `Album` without provider taxonomy becoming Yara identity.
- Added forward-only `0003_catalog_album_metadata`; both existing `0002 → 0003` and fresh `0001 → 0002 → 0003` paths are integration-tested, including legacy data/history preservation and repeat migration safety.
- Replaced deterministic development Releases with four Albums while preserving three Artists, seven Recordings, ordered relations, all seven mapping states, and production seed refusal.
- Rebuilt the canonical Node 24 Compose images; migration exited 0 and PostgreSQL, API, Worker, Web, pg_trgm, and pgvector runtime checks passed.

## Next tasks

- Review Task 1.3.2 implementation evidence.
- After approval only, consider Task 1.3.5 — External Catalog Provider Adapter.
- Run the GitHub Actions workflow after the directory is initialized/pushed as a Git repository.

## Blockers

- No Task 1.3.2 implementation blocker.
- Local shell reports Node.js 22, while the canonical container runtime is Node.js 24.22.2. Host verification and the passed Node 24 container build/runtime verification remain explicitly distinguished.
- The workspace directory is not currently initialized as a Git repository, so the workflow file is present but has not run on GitHub Actions.

## Verification status

| Check                         | Status  | Evidence / note                                                                     |
| ----------------------------- | ------- | ----------------------------------------------------------------------------------- |
| Dependency install            | Passed  | Frozen lockfile install completed; 16 workspaces                                    |
| Format check                  | Passed  | `pnpm verify` → Prettier check passed                                               |
| Lint                          | Passed  | `pnpm verify` → ESLint passed                                                       |
| Architecture dependency check | Passed  | 54 source files scanned; Domain/Application boundaries remain framework-free        |
| Context integrity check       | Passed  | 11 canonical files, seven baselines, and seven compatibility aliases verified       |
| Typecheck                     | Passed  | 12 packages + 3 apps                                                                |
| Tests                         | Passed  | Unit/domain: 6 files / 13 tests; PostgreSQL integration: 1 file / 6 tests           |
| Build                         | Passed  | Packages, API, Worker, and Next.js 16.4.3 production build                          |
| OpenAPI generation            | Passed  | OpenAPI 3.0; `/health/live` and `/health/ready` generated                           |
| Docker Compose build/startup  | Passed  | Node 24 images rebuilt; PostgreSQL, API, Worker, and Web started successfully       |
| PostgreSQL connectivity       | Passed  | PostgreSQL 18.6 healthy; migration exited 0; API and Worker probes report `ok`      |
| pgvector availability         | Passed  | API/Worker readiness report pgvector and `pg_trgm` available                        |
| API/Worker health             | Passed  | Ports 4000/4001 readiness returned 200 with all checks `ok`                         |
| Web API proxy                 | Passed  | `GET http://127.0.0.1:3000/api/health/ready` returned canonical API readiness       |
| Web production runtime        | Passed  | Docker Web and local standalone launcher served CSS/JS assets and hydrated queries  |
| SSR / refresh / hydration     | Passed  | Ant SSR styles present; refresh retained styles; browser console had no warnings    |
| Responsive smoke              | Passed  | 393×724: one-column grids, no horizontal overflow, all three status cards available |
| Catalog type safety           | Passed  | Artist/Album/Recording/provider IDs are nominally distinct                          |
| Catalog mapping invariants    | Passed  | external taxonomy separated; ref/candidate kinds and cardinality enforced           |
| Catalog migration             | Passed  | existing 0002 and fresh DB reached 0003; data/history preserved; repeat was no-op   |
| Catalog fixture seed          | Passed  | Repeatable seed: 3 Artists, 4 Albums, 7 Recordings, 7 mapping states                |
| Catalog adapter round trip    | Passed  | Artist/Album/Recording metadata, ordered relations, mappings and constraints passed |
| Task 1.3.2 integration tests  | Passed  | 1 file / 6 PostgreSQL tests on PostgreSQL 18.6                                      |
| Canonical Docker build        | Passed  | Node 24 images rebuilt; migration exit 0; API/Worker/Web health verified            |
| GitHub Actions                | Not run | Workspace is not a Git repository and has not been pushed                           |
