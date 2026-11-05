# ADR-003 — MVP Backend & Deployment Topology

> 分类：Architecture Strategy / Deployment Architecture  
> 状态：Accepted — Phase 8C Chapter 24 approval effective

## Context

Full Vision logical architecture已冻结Domain ownership、Application/AI/provider boundaries、owner-only writes、relational-first storage、derived projections和release safety。此前OQ-002未确定MVP capability、platform、scale、team与SLO，因此不能选择最终MVP backend/deployment topology。

Chapter 24将delivery分成同一architecture的两个level：MVP-0 Interview Vertical Slice交付Contextual Ask Yara、Find Music recommendation/save与tiny explicit Memory continuity；MVP-1 Limited Beta验证更完整的product/operations scope。MVP-0是Web-only single-developer executable subset；MVP-1团队假设1–3 engineers，reference capacity约`10^3` registered users、`10^2` concurrent sessions、`10^4` AI requests/day和`10^6`以内objects/evidence chunks。两者使用一个经过eligibility确认的single region；Community、Human Messaging、Live、Physical、commerce及irreversible external effects均deferred。

## Decision Drivers

- 以最小operational burden证明AI Music Companion vertical slice；
- physical topology不得改变semantic ownership或write authority；
- 需要独立扩展interactive API与background/index workloads；
- 保留SSE、outbox/jobs、Hybrid Retrieval、Memory/Taste和StructuredResult所需能力；
- 1–3人团队不能承担day-one microservices、Kafka、Kubernetes或polyglot persistence；
- topology必须保留evidence-driven extraction与specialized-store escape hatches；
- production region/provider仍必须通过privacy、rights、security和contract eligibility gate。

## Options

### A. Microservices per Domain

Physical boundary看似清晰，但会引入distributed transactions、service contracts、network failure、deployment/observability和small-team operations成本。MVP workload与team没有证明这些成本。Reject。

### B. Serverless functions per route/use case

可降低部分infrastructure管理，但容易按HTTP/Page切碎Application/Domain boundaries，增加SSE、long-running task、database connection与worker coordination复杂度。可作为hosting implementation detail，但不作为topology model。Reject as architecture baseline。

### C. Containerized Modular Monolith + Separate Worker + Managed PostgreSQL

NestJS/Fastify API承载canonical commands/queries、Application orchestration和AI request lifecycle；Node worker承载outbox、pg-boss jobs、embedding/index/projection/source-sync/cleanup；Next.js Web/BFF独立deploy；一个managed PostgreSQL cluster以owner-separated schemas/models/migrations持久化authoritative state、coordination、FTS、pgvector和relationship projections。Redis与Object Storage only conditional；Python/FastAPI不进入production MVP runtime。Recommend。

## Decision

Phase 8C已批准，正式接受Option C：

1. MVP backend是TypeScript/Node.js NestJS + Fastify Modular Monolith，不按Domain/Page拆microservices。
2. Web/BFF独立deploy，但只负责UI/view composition和transport proxy，不拥有mutation或final AuthZ。
3. Worker作为separately scalable deployable，运行outbox/pg-boss与实际需要的embedding/index/projection/source-sync/cleanup jobs；不获得business authority。
4. 使用一个managed PostgreSQL cluster，落实ADR-013 owner-separated schemas/models/migrations/repositories；FTS、pg_trgm、pgvector与relational edge projection是derived materialization。
5. Redis不是mandatory dependency；仅在shared rate limiting或bounded safe cache有证据时加入。Object Storage仅在approved artifact/export/image use case出现时加入。
6. Webhook ingress如出现，是logical trust/capture boundary，可与API co-locate；不强制独立microservice。
7. Python保留offline tooling/PoC；FastAPI production service只有Python-specific runtime、independent scale/GPU、failure isolation或deployment evidence才可加入。
8. 不采用Kubernetes、Kafka、Temporal、Neo4j、dedicated search/vector DB或multi-region作为MVP baseline。
9. 一个eligible launch region是deployment precondition；exact region/cloud SKU/provider contract不改变本ADR topology，但未通过eligibility时production launch必须阻断。
10. MVP-0与MVP-1复用同一topology、owners、ports和migration path；MVP-0的较小delivery scope不建立第二套backend或独立deployment ADR。

## Consequences

- 小团队可用few deployables交付和观测完整vertical slice。
- API与worker可独立扩展/回滚，Domain ownership仍由packages/ports/repositories而非process决定。
- PostgreSQL是较大的shared physical failure boundary，需要managed HA/PITR、pool isolation、owner migrations、capacity monitoring和restore rehearsal。
- Search/vector/graph workload增长时可能与authoritative workload竞争；ports、versioned projections和rebuild流程提供迁移路径。
- Web-first降低client breadth；Expo slice复用相同contracts，不创建第二backend。
- Community/Messaging/commerce等Future scope不能以“已有API容器”为由绕过独立policy、retention、scale和ADR review。

## Rejected / Deferred Infrastructure

- Microservices per Domain、Kubernetes、Kafka：deferred until scale/team/fault-isolation evidence。
- Redis/Object Storage：conditional, not required for core journeys。
- FastAPI、LangGraph production、MCP production：deferred/PoC；not product dependencies。
- Dedicated Search/Vector/Graph stores、Temporal、multi-region：trigger-based future candidates。

## Validation / Acceptance Evidence

- J1/J2 E2E journey and owner-boundary architecture tests；
- API/worker/container build and independent rollout evidence；
- PostgreSQL migration、outbox/job、FTS/pgvector/edge benchmark；
- staging load test against Chapter 24 reference envelope；
- migration rehearsal、PITR/restore/reapply-deny test；
- SSE reconnect/poll fallback and provider/model degraded outcomes；
- release-blocking AuthZ/privacy/rights/AI evaluation hard gates；
- release manifest、canary abort、observability and runbooks。

## Revisit Conditions

- launch requires multiple regions or hard data-residency isolation；
- measured API/worker/database/search/vector/graph workload cannot satisfy approved SLO/cost；
- independent security/fault isolation or team ownership requires process/data separation；
- number/complexity of long-running workflows justifies Temporal；
- event throughput/retention/multi-consumer ecosystem justifies broker/streaming platform；
- Messaging/Community/commerce becomes MVP/V1 scope and changes retention、moderation、realtime or effect model；
- team size/operational model changes materially。

## Related Decisions

- ADR-002 — Full Vision and MVP views
- ADR-004 — Domain boundaries and ownership
- ADR-006 — Workflow and Agent orchestration
- ADR-007 — Retrieval and Reranking positioning
- ADR-009 — Music Knowledge/Graph boundary and materialization
- ADR-012 — External provider Integration/ACL
- ADR-013 — Relational-first owner-separated storage
- ADR-014 — Messaging physical boundary（Planned）
