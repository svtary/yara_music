# CURRENT TASK — Codex

The former Figma execution task is complete and superseded.

Current phase: **MVP-0 Implementation**  
Current status: **STAGE 2 — ACCEPTED**

Completed in Stage 1:

- External Catalog Provider Integration
- Search Backend
- Search + Detail Frontend

The complete user-facing Catalog slice now runs through responsive Explore/Search, the Next BFF, typed Search results, canonical-ID navigation, and real Artist/Album/Recording Detail APIs. Album track order, URL query restoration, image fallback, async/error/not-found states, and runtime canonical IDs are verified.

Completed in Stage 2:

- Yara-owned Conversation and committed message persistence
- separately observable AI execution runs
- `ModelProviderPort` behind a minimal controlled `AgentRuntimePort`
- Yara-owned SSE events, bounded replay, reconnect, cancel, and poll fallback
- responsive Ask Yara Web surface based on the approved Figma design
- owner-separated PostgreSQL conversation/run/event persistence
- provider-neutral Model Provider boundary with a real OpenAI Responses adapter
- bounded context, success-only assistant commit, safe failure/cancel semantics
- SSE replay/reconnect and polling fallback from the same authority
- `/yara` Yara Home with explicit-create-only semantics
- PostgreSQL-backed Continue Conversation and bounded Y-07 Conversation History
- Explore → Yara → Continue/History cross-navigation with committed-history restoration
- real model response and success-only assistant commit verified in the Node 24 Compose runtime
- atomic and semantically idempotent `StartConversationWithMessage`
- transactional PostgreSQL outbox + pg-boss durable AI dispatch owned by Worker, including lease/heartbeat/recovery
- one-active-run-per-Conversation enforcement in Application and PostgreSQL
- active-run restoration through Continue, History, and refresh
- bounded History read query and bounded polling/requery failure handling
- mandatory Mobile/Desktop Figma fidelity rule recorded in `AGENTS.md`

Both safe provider-failure behavior and a real external model success path were verified. Opening or returning to `/yara` does not create an empty Conversation; only explicit prompt submission creates one Conversation and one AI execution run. The Stage 2 reliability closure also verified duplicate client retry, API restart after command commit, and Worker restart with pending durable work; no Stage 3 capability was started.

Explicitly deferred: RAG, Knowledge retrieval, citations, Recommendation, Taste, Memory, Tool Calling, StructuredResult commit, Collection, Agent SDK, LangGraph, MCP, and multi-agent behavior.

Next stage: **Stage 3 — Knowledge / Hybrid Retrieval / Evidence Package / Citations**. It has not started; do not begin it automatically.

Use `PLANS.md` for detailed progress, blockers, and verification evidence. Use `docs/technical/Yara-Technical-Design.md` and Accepted ADRs for architecture. Use the approved Figma Product Design System as the visual and interaction source of truth. This file is only a compatibility pointer for agents that still inspect the legacy task path.
