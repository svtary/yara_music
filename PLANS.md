# Yara MVP-0 Implementation Plan

This file tracks implementation progress. It does not create or modify architecture decisions; `docs/technical/Yara-Technical-Design.md` and Accepted ADRs remain canonical.

## Roadmap

| Stage | Scope                                                                                     | Status                           |
| ----- | ----------------------------------------------------------------------------------------- | -------------------------------- |
| 0     | Repository foundation: monorepo boundaries, contracts, local PostgreSQL/Compose, CI smoke | **ACCEPTED**                     |
| 1     | Identity, Catalog, canonical mapping, Search, Detail, UI                                  | **ACCEPTED** — Task 1.5 complete |
| 2     | Conversation / SSE / Model Adapter                                                        | Not started                      |
| 3     | Knowledge, Hybrid Retrieval, Evidence Package, citations                                  | Not started                      |
| 4     | Typed Tools, StructuredResult lifecycle, clarification, idempotent save                   | Not started                      |
| 5     | Collection, explicit Taste, grounded Recommendation                                       | Not started                      |
| 6     | Bounded Memory, Why This, Edit, Forget propagation                                        | Not started                      |
| 7     | Evaluation, security, privacy, reliability hard gates                                     | Not started                      |
| 8     | Staging, canary, migration/restore rehearsal, operational evidence                        | Not started                      |

## Current stage

**STAGE 1 — ACCEPTED**

## Current task

No active implementation task. Task 1.5 and Stage 1 are complete and accepted. Stop; do not begin Stage 2 automatically.

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
- Added a typed MusicBrainz HTTP client with a meaningful User-Agent, explicit timeout, default one-request-per-second pacing, bounded retry, 404 handling, and fail-closed Zod DTO validation. Cover Art Archive 404/outage degrades to an Album without cover rather than rejecting Catalog acceptance.
- Added a Provider ACL that maps MusicBrainz Artist → Artist, Release Group → Album, and Recording → Recording. A representative MusicBrainz release is used only to observe an ordered tracklist; Physical release identity/payload is not persisted as Catalog Album truth.
- Added `CatalogIngestionService` plus minimal provider/write/projection ports. PostgreSQL acceptance uses provider-identity advisory locking, owner-local transactions, opaque Yara canonical IDs, auditable ProviderMapping, relation replacement, and repeated-ingest identity reuse.
- Added the controlled `apps/catalog-cli` entry point for MusicBrainz Artist/Album/Recording ingestion and explicit Search projection rebuild; no unauthenticated ingestion HTTP endpoint was introduced.
- Added forward migration `0004_catalog_search_projection` with a Search-owned, derived, rebuildable `search.catalog_documents` projection. Exact/prefix, PostgreSQL FTS, and pg_trgm matching use deterministic lexical ranking without popularity, Taste, Recommendation, LLM, or vector ranking.
- Added typed `/search`, `/artists/:id`, `/albums/:id`, and `/recordings/:id` API routes. Controllers delegate to Application queries; Search never live-proxies MusicBrainz, and Detail read models do not expose database rows or provider payloads.
- Preserved deterministic Catalog fixtures and proved they remain searchable. Isolated PostgreSQL tests cover migration, rebuild determinism, ranking, detail assembly, repeated provider ingest, canonical/provider identity separation, and aggregate rollback.
- Executed a real paced MusicBrainz/Cover Art Archive smoke: imported Radiohead, the OK Computer release-group, and its 12 representative recordings. The same Airbag Recording was directly re-ingested and reused its existing Yara canonical ID; Docker Search and Detail returned the imported data.
- Regenerated OpenAPI with the typed Search result union and three Detail schemas; CI now seeds fixtures, rebuilds Search, and smokes all new routes without external network access.
- Added shared Catalog transport contracts and a bounded Web API client with runtime shape validation. Browser reads remain behind narrow Next Route Handler BFF proxies; Web does not import Domain, adapters, provider payloads, or database rows.
- Added responsive `/explore`, `/artists/[id]`, `/albums/[id]`, and `/recordings/[id]` product routes. Search uses URL query state, a 320 ms debounce, TanStack Query cancellation/placeholder data, and intentional Track/Album/Artist presentations.
- Added real-data Artist, Album, and Recording Detail surfaces, including authoritative Album track order, cross-object canonical navigation, duration formatting, missing-image fallback, and distinct loading/idle/empty/error/not-found states.
- Fixed and regression-tested the canonical route boundary discovered during runtime verification: encoded Next path parameters are decoded once at ingress and encoded once for each outbound path, so IDs such as `album:yara:<uuid>` are never double-encoded.
- Verified the complete Docker/browser journey with imported MusicBrainz data: Radiohead Search, real OK Computer Album with 12 ordered recordings, Airbag Recording, Artist Detail, browser Back/query restoration, no-results, 404, desktop, and 393 px responsive behavior.
- Task 1.5 — Search + Detail Frontend completed Stage 1 and was accepted after repository and runtime verification.

## Next tasks

- **Stage 2 — Conversation / SSE / Model Adapter**. Not started; begin only after explicit approval.

## Blockers

- No Stage 1 implementation blocker.
- Local shell reports Node.js 22, while the canonical container runtime is Node.js 24.22.2. Host verification and the passed Node 24 container build/runtime verification remain explicitly distinguished.
- The repository is on branch `feat/musicbrainz-catalog-adapter` with remote `origin`; GitHub Actions was not run from this local implementation turn.

## Verification status

| Check                         | Status  | Evidence / note                                                                      |
| ----------------------------- | ------- | ------------------------------------------------------------------------------------ |
| Dependency install            | Passed  | Frozen lockfile install completed in Docker; 18 workspaces                           |
| Format check                  | Passed  | `pnpm verify` → Prettier check passed                                                |
| Lint                          | Passed  | `pnpm verify` → ESLint passed                                                        |
| Architecture dependency check | Passed  | 105 source files scanned; Domain/Application boundaries remain framework-free        |
| Context integrity check       | Passed  | 11 canonical files, seven baselines, and seven compatibility aliases verified        |
| Typecheck                     | Passed  | 13 packages + 4 apps                                                                 |
| Tests                         | Passed  | Unit/default: 10 files / 45 tests; PostgreSQL integration: 2 files / 12 tests        |
| Build                         | Passed  | Packages, Catalog CLI, API, Worker, and Next.js 16.4.3 production build              |
| OpenAPI generation            | Passed  | Health, typed `/search`, and Artist/Album/Recording Detail paths generated           |
| Docker Compose build/startup  | Passed  | Node 24 images rebuilt; PostgreSQL, API, Worker, and Web started successfully        |
| PostgreSQL connectivity       | Passed  | PostgreSQL 18.6 healthy; migration exited 0; API and Worker probes report `ok`       |
| pgvector availability         | Passed  | API/Worker readiness report pgvector and `pg_trgm` available                         |
| API/Worker health             | Passed  | Ports 4000/4001 readiness returned 200 with all checks `ok`                          |
| Web API proxy                 | Passed  | `GET http://127.0.0.1:3000/api/health/ready` returned canonical API readiness        |
| Web production runtime        | Passed  | Docker Web and local standalone launcher served CSS/JS assets and hydrated queries   |
| SSR / refresh / hydration     | Passed  | Ant SSR styles present; refresh retained styles; browser console had no warnings     |
| Responsive smoke              | Passed  | 393 px Catalog UI: mobile nav, stable cards, no horizontal overflow                  |
| Catalog type safety           | Passed  | Artist/Album/Recording/provider IDs are nominally distinct                           |
| Catalog mapping invariants    | Passed  | external taxonomy separated; ref/candidate kinds and cardinality enforced            |
| Catalog migration             | Passed  | existing 0002 and fresh DB reached 0004; data/history preserved; repeat was no-op    |
| Catalog fixture seed          | Passed  | Repeatable seed: 3 Artists, 4 Albums, 7 Recordings, 7 mapping states                 |
| Catalog adapter round trip    | Passed  | Artist/Album/Recording metadata, ordered relations, mappings and constraints passed  |
| Task 1.3.2 integration tests  | Passed  | 1 file / 6 PostgreSQL tests on PostgreSQL 18.6                                       |
| Canonical Docker build        | Passed  | Node 24 images rebuilt; migration exit 0; API/Worker/Web health verified             |
| Provider unit tests           | Passed  | DTO/ACL, pacing, timeout, 404, 503, retry bound, malformed response, CAA degradation |
| Catalog Search projection     | Passed  | Fixture/imported data, deterministic rebuild/rank, FTS/prefix/trigram verified       |
| Catalog Detail APIs           | Passed  | Artist/Album/Recording, ordered tracklist, contexts, 404, no row/payload leakage     |
| Real Provider smoke           | Passed  | Radiohead → OK Computer → 12 recordings; CAA cover; Airbag idempotent re-ingest      |
| Docker Search/Detail runtime  | Passed  | Node 24 API served imported Airbag Search/Detail; API/Worker healthy; Web 200        |
| Frontend behavior tests       | Passed  | 1 file / 12 tests: states, union groups, API boundary, IDs, Detail, order, duration  |
| Search/Detail Web routes      | Passed  | `/explore` and canonical Artist/Album/Recording routes built and served              |
| Browser vertical slice        | Passed  | Radiohead → OK Computer → Airbag → Back restored `?q=Radiohead`                      |
| Frontend state handling       | Passed  | Idle, loading logic, no-results, transport error logic, malformed response, 404      |
| Responsive Catalog UI         | Passed  | Desktop rail and 393 px mobile nav; no horizontal overflow; console clean            |
| GitHub Actions                | Not run | Workflow updated; no remote Actions run was triggered in this local turn             |
