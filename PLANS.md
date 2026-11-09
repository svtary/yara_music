# Yara MVP-0 Implementation Plan

This file tracks implementation progress. It does not create or modify architecture decisions; `docs/technical/Yara-Technical-Design.md` and Accepted ADRs remain canonical.

## Roadmap

| Stage | Scope                                                                                     | Status                           |
| ----- | ----------------------------------------------------------------------------------------- | -------------------------------- |
| 0     | Repository foundation: monorepo boundaries, contracts, local PostgreSQL/Compose, CI smoke | **ACCEPTED**                     |
| 1     | Identity, Catalog, canonical mapping, Search, Detail, UI                                  | **ACCEPTED** — Task 1.5 complete |
| 2     | Conversation / SSE / Model Adapter                                                        | **ACCEPTED**                     |
| 3     | Knowledge, Hybrid Retrieval, Evidence Package, citations                                  | Not started                      |
| 4     | Typed Tools, StructuredResult lifecycle, clarification, idempotent save                   | Not started                      |
| 5     | Collection, explicit Taste, grounded Recommendation                                       | Not started                      |
| 6     | Bounded Memory, Why This, Edit, Forget propagation                                        | Not started                      |
| 7     | Evaluation, security, privacy, reliability hard gates                                     | Not started                      |
| 8     | Staging, canary, migration/restore rehearsal, operational evidence                        | Not started                      |

## Current stage

**STAGE 2 — ACCEPTED**

## Current task

Stage 2 is complete and accepted. No Stage 3 implementation has started.

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
- Added framework-free Yara Interaction conversation semantics with opaque `ConversationId` / `MessageId`, committed user/assistant messages, deterministic ordering, and no durable partial-message state.
- Added a separately observable `AIExecutionRun` state machine and preserved `YaraConversation != YaraTask != AIExecutionRun != AgentSession`; Stage 2 does not introduce Task or AgentSession aliases.
- Added owner-separated `yara_interaction` PostgreSQL tables through forward migration `0005_yara_interaction_foundation`, including transactional user-message/run acceptance, terminal assistant commit, and replayable run-event sequencing.
- Added a provider-neutral `ModelProviderPort`, a higher-level pass-through `AgentRuntimePort`, and a real OpenAI Responses streaming adapter. Provider SDK types and raw failures do not cross the adapter boundary.
- Added typed server-only model configuration with a safe `disabled` default; a model API key is required only when `MODEL_PROVIDER=openai`.
- Added Application orchestration for bounded recent Conversation context, run execution, safe failure/cancel behavior, and assistant-message commit only after successful provider completion. Context compaction does not create Memory.
- Added typed Conversation/Run HTTP contracts and OpenAPI routes for create/read/send, poll, cancel, and SSE. Yara-owned SSE uses event sequence IDs, bounded replay, heartbeat, terminal close, current-owner recheck, and polling fallback from the same persisted authority.
- Added responsive `/yara` Web UI and narrow Next BFF routes with durable message history, ephemeral streaming partials, loading/failure/retry/stop/reconnect states, refresh-resumable run identity, and distinct disconnect versus cancel behavior.
- Verified the provider-disabled runtime path on the host build and in Node 24 Compose containers: `run.started → run.failed`, Last-Event-ID replay, poll consistency, and no fabricated assistant message. Desktop and mobile-breakpoint screenshots were inspected.
- Closed the frozen Stage 2 product slice: `/yara` is now Yara Home and performs no implicit mutation; explicit prompt submission creates exactly one Conversation and AIExecutionRun before navigating to the canonical streaming Conversation URL.
- Added the bounded Y-07 Conversation History read model and real PostgreSQL-backed Continue behavior. Empty conversations are excluded, recent activity ordering is deterministic, and reopened conversations restore committed history after refresh or primary navigation.
- Matched the inspected Mobile/Desktop Yara Home, Conversation, and History Figma hierarchy without fabricating later-stage citations, Tasks, Recommendation/Taste, or Memory capabilities.
- Verified a real model completion (`YARA_FINAL_CLOSURE_OK`) in the rebuilt Node 24 Compose runtime, then verified Explore → Yara Home → Continue/History → reopened committed history end to end.
- Stage 2 — Conversation / SSE / Model Adapter completed and was accepted without starting RAG, Knowledge, citations, Recommendation, Taste, Memory, Tool Calling, StructuredResult, Collection, Agent SDK, MCP, LangGraph, or multi-agent work.
- Closed the Stage 2 reliability review without changing product architecture: conversation start now atomically commits the Conversation, first user message, pending `AIExecutionRun`, durable job, and semantic idempotency receipt in one PostgreSQL owner transaction.
- Moved AI execution ownership out of the API process into the separate Worker. The owner-transactional PostgreSQL outbox is dispatched through the frozen pg-boss Worker baseline; PostgreSQL claim, lease, heartbeat, stale-pending recovery, and conservative running/unknown-outcome reconciliation prevent lost or blindly replayed provider work.
- Enforced at most one `pending | running` execution per Conversation through both an Application conflict and a PostgreSQL partial unique index. Conversation and History read models expose the active run so Continue, History, and refresh reconnect to it instead of appearing Ready.
- Replaced History aggregate loading with one bounded read-model query and added bounded polling backoff, a maximum observation window, transport error handling, and authoritative run re-query behavior.
- Added the mandatory project-wide Figma fidelity rule to `AGENTS.md` after inspecting Mobile Y-01/Y-02/Y-07, AI generating/error/partial states, and Desktop Conversation/History/Generating frames. No new product state or Stage 3 capability was introduced.
- Rebuilt the canonical Node 24 Compose runtime and verified duplicate start retry, real Worker/model completion, API restart after command commit, Worker restart with pending durable work, persisted assistant recovery, and healthy API/Worker/Web services.

## Next tasks

- **Stage 3 — Knowledge / Hybrid Retrieval / Evidence Package / Citations**. Do not begin it automatically.

## Blockers

- No Stage 2 implementation blocker.
- Local shell reports Node.js 22, while the canonical container runtime is Node.js 24.22.2. Host verification and the passed Node 24 container build/runtime verification remain explicitly distinguished.
- The repository is on branch `feat/musicbrainz-catalog-adapter` with remote `origin`; GitHub Actions was not run from this local implementation turn.

## Verification status

| Check                         | Status  | Evidence / note                                                                                                                                                          |
| ----------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Dependency install            | Passed  | Frozen lockfile install passed; 470-entry supply-chain policy check passed                                                                                               |
| Format check                  | Passed  | `pnpm verify` → Prettier check passed                                                                                                                                    |
| Lint                          | Passed  | `pnpm verify` → ESLint passed                                                                                                                                            |
| Architecture dependency check | Passed  | 145 source files scanned; Domain/Application/AI Runtime rules passed                                                                                                     |
| Context integrity check       | Passed  | 11 canonical files, seven baselines, and seven compatibility aliases verified                                                                                            |
| Typecheck                     | Passed  | 13 packages + 4 apps                                                                                                                                                     |
| Tests                         | Passed  | Unit/default: 19 files / 72 tests; PostgreSQL integration: 3 files / 16 tests                                                                                            |
| Build                         | Passed  | All packages, Catalog CLI, API, Worker, and Next.js 16.4.3 production build                                                                                              |
| OpenAPI generation            | Passed  | Catalog plus typed Conversation, AI run, cancel, poll, and SSE paths generated                                                                                           |
| Docker Compose image rebuild  | Passed  | Current migrate/API/Web images rebuilt on the canonical Node 24.22.2 base                                                                                                |
| Docker Compose startup        | Passed  | Migration exited 0; PostgreSQL, API, Worker, and Web are running; health checks pass                                                                                     |
| PostgreSQL connectivity       | Passed  | PostgreSQL 18.6 healthy; migration exited 0; API and Worker probes report `ok`                                                                                           |
| pgvector availability         | Passed  | API/Worker readiness report pgvector and `pg_trgm` available                                                                                                             |
| API/Worker health             | Passed  | Ports 4000/4001 readiness returned 200 with all checks `ok`                                                                                                              |
| Web API proxy                 | Passed  | `GET http://127.0.0.1:3000/api/health/ready` returned canonical API readiness                                                                                            |
| Web production runtime        | Passed  | Docker Web and local standalone launcher served CSS/JS assets and hydrated queries                                                                                       |
| SSR / refresh / hydration     | Passed  | Ant SSR styles present; refresh retained styles; browser console had no warnings                                                                                         |
| Responsive smoke              | Passed  | 393 px Catalog UI: mobile nav, stable cards, no horizontal overflow                                                                                                      |
| Catalog type safety           | Passed  | Artist/Album/Recording/provider IDs are nominally distinct                                                                                                               |
| Catalog mapping invariants    | Passed  | external taxonomy separated; ref/candidate kinds and cardinality enforced                                                                                                |
| Catalog migration             | Passed  | existing 0002 and fresh DB reached 0004; data/history preserved; repeat was no-op                                                                                        |
| Catalog fixture seed          | Passed  | Repeatable seed: 3 Artists, 4 Albums, 7 Recordings, 7 mapping states                                                                                                     |
| Catalog adapter round trip    | Passed  | Artist/Album/Recording metadata, ordered relations, mappings and constraints passed                                                                                      |
| Task 1.3.2 integration tests  | Passed  | 1 file / 6 PostgreSQL tests on PostgreSQL 18.6                                                                                                                           |
| Canonical Docker build        | Passed  | Node 24 images rebuilt; migration exit 0; API/Worker/Web health verified                                                                                                 |
| Provider unit tests           | Passed  | DTO/ACL, pacing, timeout, 404, 503, retry bound, malformed response, CAA degradation                                                                                     |
| Catalog Search projection     | Passed  | Fixture/imported data, deterministic rebuild/rank, FTS/prefix/trigram verified                                                                                           |
| Catalog Detail APIs           | Passed  | Artist/Album/Recording, ordered tracklist, contexts, 404, no row/payload leakage                                                                                         |
| Real Provider smoke           | Passed  | Radiohead → OK Computer → 12 recordings; CAA cover; Airbag idempotent re-ingest                                                                                          |
| Docker Search/Detail runtime  | Passed  | Node 24 API served imported Airbag Search/Detail; API/Worker healthy; Web 200                                                                                            |
| Frontend behavior tests       | Passed  | 1 file / 12 tests: states, union groups, API boundary, IDs, Detail, order, duration                                                                                      |
| Search/Detail Web routes      | Passed  | `/explore` and canonical Artist/Album/Recording routes built and served                                                                                                  |
| Browser vertical slice        | Passed  | Radiohead → OK Computer → Airbag → Back restored `?q=Radiohead`                                                                                                          |
| Frontend state handling       | Passed  | Idle, loading logic, no-results, transport error logic, malformed response, 404                                                                                          |
| Responsive Catalog UI         | Passed  | Desktop rail and 393 px mobile nav; no horizontal overflow; console clean                                                                                                |
| Conversation Domain           | Passed  | Typed identity, committed-only message/order invariants, Conversation/Run separation                                                                                     |
| AI execution orchestration    | Passed  | Success-only assistant commit; provider failure stores safe run failure only                                                                                             |
| Provider adapter              | Passed  | OpenAI Responses events normalized; safe rate-limit/failure mapping tested                                                                                               |
| Yara Interaction persistence  | Passed  | Migrations 0005–0006, owner reads, atomic start/idempotency, active-run uniqueness, durable job recovery, rollback, and duplicate assistant prevention tested on PG 18.6 |
| SSE / polling runtime         | Passed  | Started/failed replay, Last-Event-ID, terminal close, and authoritative poll verified                                                                                    |
| Yara Home / History runtime   | Passed  | No implicit create; real Continue/history list; cross-nav and committed restore passed                                                                                   |
| Yara Web / BFF runtime        | Passed  | Home → create/send → SSE → Explore → Home → Continue/History → reopen verified                                                                                           |
| Real model smoke              | Passed  | Real provider returned committed `YARA_FINAL_CLOSURE_OK` through the browser flow                                                                                        |
| Durable execution runtime     | Passed  | `yara_jobs` pg-boss queue installed; duplicate start returned one receipt; Worker completed persisted job after API/Worker restart boundary                              |
| Figma fidelity review         | Passed  | Mobile Y-01/Y-02/Y-07, AI failure/generating/partial, and Desktop Yara equivalents inspected; no deviation introduced                                                    |
| GitHub Actions                | Not run | Workflow updated; no remote Actions run was triggered in this local turn                                                                                                 |
