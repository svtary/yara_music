# AGENTS.md — Yara MVP-0 Engineering Rules

## Canonical priority

1. `docs/technical/Yara-Technical-Design.md` and Accepted ADRs are the canonical architecture source of truth.
2. Frozen product files (`docs/product/YARA_MASTER_CONTEXT.md`, `docs/product/DECISIONS.md`, `docs/product/baselines/`) remain authoritative for product semantics.
3. `PLANS.md` tracks delivery status only. It is not an architecture document.
4. `docs/INDEX.md` is the canonical context map and reading guide. It routes agents to source documents but does not override them.
5. Code, tests, README files, generated contracts, and deployment configuration must conform to the sources above. If they conflict, stop the affected change and report the exact blocker; do not silently redesign architecture.

Legacy root paths (`YARA_MASTER_CONTEXT.md`, `DECISIONS.md`, `CURRENT_TASK.md`, `baselines/`, `execution/`, `assets/`, and `reference/`) are compatibility symlinks only. Their targets under `docs/` are canonical; never create a second editable copy at a legacy path.

Current phase: **MVP-0 Implementation**. Current delivery stage is recorded in `PLANS.md`.

## Dependency and ownership rules

- Dependencies point inward: delivery/infrastructure adapters → Application ports/use cases → framework-free Domain owners. Domain and Application code must not depend on NestJS, Next.js, database drivers, provider SDKs, or delivery adapters.
- Domain owners alone authorize and commit their canonical writes. Cross-domain mutations go through typed Application commands and owner-authorized ports.
- Shared PostgreSQL is physical co-location, not shared ownership. Keep owner-separated schemas, migrations, repositories, and row models. No cross-owner repository imports or shared ORM Domain entities.
- BFF code may compose views and proxy transport. It must not own canonical mutation, business transactions, Domain invariants, or final AuthZ.
- Provider IDs and payloads are observations/mappings, never Yara canonical identity or Domain truth.

## Non-collapsible semantic boundaries

- `YaraConversation != YaraTask != AIExecutionRun != AgentSession`.
- `AgentRuntimePort != ModelProviderPort`.
- `Search != Retrieval != Recommendation`.
- `Taste != Memory != Collection`.
- `StructuredResult != SavedResult != Collection`.
- `Context Compaction != Memory creation`.
- Provider-hosted session or trace state is replaceable metadata and cannot be the only durable Yara product state.

## AI and mutation safety

- AI Runtime performs execution mechanics only. It cannot directly write Memory, Taste, Knowledge, Collection, authorization state, or committed Structured Results. Mutations must use typed Application ports and the owning Domain command path.
- Model/provider output is an execution candidate. Yara-side validation and the authoritative owner commit the result.
- `RequiredAction` binds the exact action, target, material parameters, expected version, expiry, and consumed/superseded state. It is never blanket permission.
- An `IdempotencyKey` is semantically bound to one operation identity/fingerprint. Reusing a key with different intent must fail.
- `UnknownOutcome` is never blindly retried. Verify provider status or reconcile through the approved stable effect identity before any repeat.

## Authorization, projection, and streaming safety

- Current AuthZ, Consent, purpose, rights, region, delete, and Forget deny decisions override caches, search/vector/graph projections, provider continuation state, and replay history.
- SSE cursor/sequence represents delivery position only. Reconnect, replay, and resume must re-check current authorization; return refresh/deny when safe replay is impossible.
- Memory Forget establishes an immediate authoritative deny, then propagates cleanup/rebuild through derived indexes, caches, evaluation datasets, telemetry handling, and backup-restore reapplication. Forgotten content must not become usable again through a stale copy.

## Delivery-stage boundaries

- **P0:** controlled TypeScript runtime, typed Function Tools, Structured Output, Hybrid RAG, bounded Memory, SSE, basic redacted OpenTelemetry and structured execution metadata.
- **P1:** Agent SDK adapters, read-first MCP, Skills, advanced Agent Trace/deeper OTel, LangGraph comparison PoC, optional Redis/reranker/Python evaluation tooling.
- **P2:** measured multi-agent/handoff, durable workflow engine, A2A, specialized inference, or Kubernetes only after explicit evidence and approval.
- MVP-0 must not depend on Agents SDK, MCP, Skills, LangGraph, Redis, Kafka, Kubernetes, Neo4j, OpenSearch, a dedicated vector database, Temporal, Multi-Agent, or a production FastAPI service.
- Do not introduce premature infrastructure. New infrastructure requires the frozen Technical Design trigger (measured scale/SLO, isolation, residency, workflow, or team-ownership evidence) and any required ADR.

## Working rules

- Before changing implementation, read this file, `PLANS.md`, `docs/INDEX.md`, and the relevant canonical Product/Technical Design/ADR sections selected by the context map.
- Preserve user changes and keep changes scoped to the current stage.
- Do not claim a verification as passing unless it was actually executed successfully.
- Do not begin the next stage automatically; update `PLANS.md`, report status, and stop for review.
