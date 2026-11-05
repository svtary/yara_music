# ADR-012 — External Provider Integration & Anti-Corruption Layer

> 分类：External Integration Architecture  
> 状态：Accepted — logical integration architecture only

## Context

Yara依赖music metadata、playback、Live/ticket、Physical marketplace、editorial/licensed content、maps/location、delivery与Model providers。各provider的identity、payload、rights、freshness、error和quota semantics不同；raw provider data不能污染canonical domain model，也不能因被Yara存储而改变authority。需要一个vendor-neutral、domain-aligned的integration boundary。

## Decision Drivers

- Provider IDs与Yara canonical IDs严格分离；
- Catalog、Live、Physical、Knowledge及其他domains保持semantic/write authority；
- provider-authoritative current observations保留source、time、region、rights和limitations；
- provider-specific SDK、payload、enum、auth、quota和errors不泄漏domain/application；
- correction/withdrawal、mapping merge/split、cache/index/claim propagation可追踪；
- multiple providers、partial failure、fallback与quota可被逐data-class治理；
- MVP保持最低复杂度，不提前选择vendor、service topology或event infrastructure。

## Options

### A. Each domain integrates providers directly

Domain semantics靠近owner，但SDK/auth/retry/observability重复，provider coupling容易进入domain core。仅适合极小一次性integration，不作为architecture。

### B. Central Integration Layer owns all provider semantics

复用高，但会形成giant `ExternalProviderService`并夺取Catalog/Live/Physical/Knowledge的semantic decision authority。Reject。

### C. Shared integration infrastructure + domain/application-owned semantic ports

Ports按music metadata、playback、live、physical market、editorial、location、delivery与model等semantic capabilities定义；Adapters/ACL处理provider specifics，共享credentials、transport、quota、retry、telemetry primitives。Domain/Application仍决定domain semantic normalization、canonical mapping acceptance、conflicts与writes。Recommend。

### D. Provider-centric services

便于按vendor组织，但domain use cases反向依赖provider taxonomy，替换困难且容易复制canonical semantics。Reject。

## Decision

1. 采用Option C：semantic ports/contracts由domain/application capability拥有，shared integration infrastructure承载Adapters/ACL和cross-cutting runtime concerns；不建立giant provider owner。
2. 集成按semantic capability采用两类archetype：Data/Observation integration遵循`Provider → Adapter/ACL → ProviderObservation → Canonical Resolution（where applicable）→ Domain Semantic Normalization → Domain/Application Decision → Authoritative State / Projection`；Capability/Execution integration遵循`Application/Runtime Request → Semantic Capability Port → Provider Adapter → External Capability Execution → Execution Result/Status Observation → Application/Runtime Handling`。Playback等provider可以同时具有两种surface；并非所有integration都需要canonical resolution或observation-to-truth流程。Raw payload永不直接成为domain entity。
3. Observation-oriented integration中的`ProviderObservation`保留provider/source identity、provider object/type、payload/reference、observed/effective time、region/market、source status/version、freshness/expiry、usage rights、mapping status、normalization version与适用confidence；它不是domain truth。Execution-oriented integration返回typed execution result/status observation，由Application/runtime处理。
4. `ProviderMapping`把provider identity映射到Yara canonical reference，支持resolved、unresolved、ambiguous、superseded、merged、split和correction。Fuzzy best match不能静默创建canonical identity。
5. Authority按semantic fact而非storage location确定：Yara normalized canonical identity/structure由domain owner持有；ticket inventory、listing price/stock、playback availability等current facts可保持provider-authoritative observation；indexes/caches为derived projections。
6. Adapter只做protocol/payload translation、validation与technical/provider normalization，包括provider enums、timestamps、transport和error/status representation。Domain semantic normalization由owning domain/application policy负责。`Technical Normalization != Domain Semantic Normalization`；canonical acceptance、multi-source conflict和domain write由owner policy决定。
7. Refresh strategy按data class选择on-demand、polling、webhook/push、batch、event-driven或user-triggered方式，不全局统一。Freshness至少表达Fresh、StaleButUsable、Expired、Unknown、Withdrawn等语义而不冻结enum/TTL。
8. Fallback必须semantic-equivalent且显式披露freshness/coverage limitation；旧availability不得冒充current。Retry、backoff、circuit、quota、coalescing与cache为policy-driven logical capabilities，具体数值deferred。
9. `EvidenceUsagePolicy`从observation/content贯穿normalized state/evidence、Retrieval、`ModelExecutionContext`与output，区分retrieval/index、model exposure、derivative、quote/display、citation/attribution、region和expiry/withdrawal。
10. Provider及canonical correction/withdrawal必须可传播到所有typed canonical-reference consumers，包括mapping、domain decision/claim、Search/index、Music Graph、Retrieval caches/references、Collection、Journey、Memory、Social/shared objects、Structured/Saved Results、Recommendation/Personalization projections及必要user-visible correction。Chapter 10只要求lineage、propagation与invalidation；各consumer owner决定semantic migration，最终mechanism deferred。
11. Model provider通过vendor-neutral `ModelGateway` adapter集成，只处理model invocation mechanics，不拥有`IntentDecision`、Memory、Taste、Knowledge、business truth或`StructuredResult` semantics。
12. Playback adapter在Yara canonical Track/Recording与provider-playable identity间解析；provider availability/rights/state仍是provider facts，final playback ownership受OQ-003/OQ-013约束。
13. Public Context Providers与Connected Personal Context Sources分离。Calendar/account-linked private context必须经explicit authorization、purpose-scoped port、permission/privacy boundary及revoke/disconnect propagation访问，不能成为unrestricted `ContextDataPort` source。
14. 本ADR只接受logical integration architecture；不接受provider/vendor、SDK、queue/cache technology、physical service boundaries或deployment topology。

## Trade-offs

- 接受semantic ports与shared infrastructure双层治理，换取domain authority和provider替换能力。
- 接受`ProviderObservation`/mapping/provenance开销，换取freshness、conflict、rights与correction可追踪。
- 不全局统一sync/fallback策略，增加policy配置面，但避免不同data classes被错误同质化。
- MVP不强制multi-provider或event platform，降低复杂度，但critical flows需明确degradation和migration path。

## Consequences

- Domain/Application代码依赖ports，不依赖provider SDK；credentials只存在Adapter/Infrastructure boundary。
- Chapter 11必须materialize observation/mapping/source/freshness/rights/conflict/idempotency/withdrawal semantics，但不得重新决定domain authority。
- Chapters 14–18分别细化external API state、components、storage、reliability与security/compliance。
- Provider payload被视为untrusted input，需schema validation、normalization、sanitization和textual prompt-injection防护。
- 未选择任何provider、model、search/vector/graph technology、message/event infrastructure或physical service topology。

## Deferred Decisions

- MVP provider set、markets/regions和critical flows：OQ-002 / Chapter 24；
- playback provider/rights/recovery：OQ-003/OQ-013；
- commerce mode：OQ-005；
- editorial/lyrics sources与rights：OQ-006；
- SLO、freshness thresholds、retry/quota/circuit parameters：OQ-008 / Chapter 17；
- data retention/export/delete与training use：OQ-004/OQ-009/OQ-012 / Chapter 18；
- logical/physical schema：Chapter 11；
- API/event contracts：Chapter 14；
- storage/cache/index/event technology：Chapters 16/22；
- final deployment topology：Chapters 17/24及ADR-003 gating。

## Revisit Conditions

- provider count、change cadence或policy差异证明需要更强physical isolation；
- shared infrastructure成为semantic decision owner或domain coupling增长；
- provider reliability/quotas无法满足critical-flow SLO；
- rights/region要求强制source-specific isolation；
- MVP scope或commerce/playback model发生实质变化。
