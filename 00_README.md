# Yara / 雅乐

Yara is now in **MVP-0 Implementation**. Product design and Technical Design v1.0 are frozen.

## Canonical sources

1. `AGENTS.md` — long-lived coding-agent constraints.
2. `PLANS.md` — current stage, task, blockers, and verification state.
3. `docs/technical/Yara-Technical-Design.md` and Accepted ADRs — canonical architecture.
4. `docs/product/YARA_MASTER_CONTEXT.md`, `docs/product/DECISIONS.md`, and `docs/product/baselines/` — frozen product semantics.
5. `docs/INDEX.md` — context map, document classification, reading profiles, and legacy-path mapping.

Canonical design and engineering context is organized under `docs/`. The root-level product-context names are compatibility symlinks for older prompts, not duplicate sources.

## Stage 0 workspace

- `apps/web` — Next.js responsive Web/BFF presentation surface.
- `apps/api` — NestJS + Fastify canonical API and OpenAPI host.
- `apps/worker` — bounded Node.js worker process and health surface.
- `packages/domain-*` — framework-free owner boundaries.
- `packages/application` — Application use-case/port boundary.
- `packages/ai-runtime` — non-authoritative AI execution boundary.
- `packages/contracts` — transport/schema contract package.
- `packages/config` — typed environment configuration.
- `packages/adapters-postgres` — Kysely/PostgreSQL infrastructure adapter.

No Stage 1 business capability is implemented in Stage 0.

## Local commands

```bash
pnpm install
pnpm verify
docker compose up --build
```

Copy `.env.example` to `.env` only when local overrides are needed. Docker Compose has local-only defaults.

## Operating rule

Treat frozen baselines as immutable unless the user explicitly approves a revision. If a conflict is found, report an exact Architecture Blocker; do not silently redesign or weaken authority/safety rules.
