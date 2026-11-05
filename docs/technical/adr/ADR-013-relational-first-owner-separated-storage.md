# ADR-013 — Relational-first Authoritative Storage Strategy with Specialized Derived Stores

> 分类：Storage Architecture  
> 状态：Accepted — logical storage strategy only

## Context

Yara包含多个独立semantic owners、long-running coordination、provider observations、Search/Vector/Graph projections、Memory/Taste、Messaging和recoverable event intents。Storage strategy既要支持owner-local strong transactions和MVP复杂度约束，也要保留derived-store specialization和未来拆分路径。

## Decision Drivers

- semantic ownership不由physical database重定义；
- authoritative transition需要owner-local consistency和recoverable event-intent lineage；
- MVP应避免premature polyglot和distributed transaction复杂度；
- Search、Vector、Music Graph和Feed是rebuildable projections，不是source truth；
- Memory、Taste、ProviderObservation和Messaging需保持独立privacy/lifecycle semantics；
- storage engine、vendor、topology和scale thresholds尚未确定。

## Options

### A. One generic shared data model/database abstraction

短期建模简单，但容易产生shared ORM entities、cross-owner writes和semantic leakage，且阻碍独立migration。Reject。

### B. Relational-first Authoritative Storage Strategy with Specialized Derived Stores

主要以owner-separated logical schemas/models/migrations/repositories保存authoritative transactional state与owner-local operational records，使用owner-local transaction boundary；Search/Vector/Graph/Cache/Blob/event infrastructure等只在access pattern、scale、rights、isolation或rebuild证据足够时采用specialized storage。Relational-first不表示每种Yara data structure都必须永久使用relational storage。支持MVP co-location与渐进迁移。Recommend。

### C. Fully polyglot-per-domain storage from start

可以物理强化边界，但在scope、SLO、scale和operations证据不足时引入过度的data movement、backup、consistency和observability成本。Not justified now。

## Decision

1. 接受Option B作为logical storage strategy。
2. Authoritative transactional state与owner-local operational records优先使用能表达owner-local transactions、versioned state、typed relationships和recoverable transition/event/invalidation/required-audit intent lineage的relational-first model。
3. 多个owners可共居一个physical transactional platform，但必须保持owner-separated logical schemas/models、migrations、repository ports和owner-only write paths。
4. 禁止one shared generic entity model、cross-owner ORM navigation和以database location推断semantic ownership。
5. Search index、Vector index、Music Graph、Feed/Public Profile、Taste feature和Availability views是rebuildable projections，不获得source authority。
6. Relational-first不约束所有Yara data structures永久使用relational storage；Search、Vector、Graph、Cache、Blob与event infrastructure可在query shape、scale、latency、fault/security isolation、rights或operational evidence充足时采用specialized storage。
7. MVP不强制dedicated graph/vector database；Music Graph和Vector semantics可先在relational/index-capable materialization中实现。
8. 本ADR不选择DB/cache/search/vector/graph/blob/event vendor、ORM、schema DDL、partitioning、replication或deployment topology。

## Consequences

- Chapter 16可定义storage classes、transactions、outbox/inbox、projections和lineage，而不预判technology。
- Chapter 22仍需使用capacity、SLO、rights、cost和operations证据选择具体products。
- Chapter 24决定MVP物理stores、co-location和migration path。
- Dedicated store的引入不转移domain authority；projection必须可rebuild并受current privacy/rights gates约束。

## Deferred Decisions

- 具体relational DB、cache、search/vector/graph engine、blob store和event infrastructure；
- physical schema、partitioning、replication、backup/restore、HA/DR和regional topology；
- numeric volume、latency、retention、rebuild和saturation thresholds；
- Messaging physical retention/isolation boundary（ADR-014）；
- final MVP deployment topology（ADR-003 / Chapter 24）。

## Revisit Conditions

- authoritative workload无法在所选relational platform满足经验证SLO；
- graph/vector/search access pattern证明specialized store必须且经济；
- data residency、rights、security或fault-isolation要求强制physical separation；
- team ownership和operational maturity支持polyglot或service extraction；
- MVP scope、Messaging/Playback model或retention义务发生实质变化。
