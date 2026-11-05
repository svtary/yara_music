# ADR-007 — Retrieval Ownership, Hybrid Retrieval & Reranking Boundary

> 分类：AI / Information Access Architecture  
> 状态：Accepted

## Context

Yara 的 user-facing Search、AI Q&A、explanation、planning、Structured Result、Recommendation candidate support、Memory recall 与 Knowledge traversal 都需要信息访问，但目标、输出、权限、ranking 和 failure semantics 不同。Catalog、Physical、Live、Knowledge、Memory 与 Personalization 已分别拥有 authoritative state；`MusicGraphQueryPort`、`MusicKnowledgePort` 与 `MemoryAccessPort` 已冻结。需要确定 Retrieval 的 logical ownership、hybrid composition、reranking boundary 与 source-of-truth rules，同时避免把它变成 giant platform 或 AI-owned truth。

## Decision Drivers

- AI 与非 AI consumers 的复用；
- typed source ports、permission/purpose、rights、region、freshness 与 provenance enforcement；
- Search result objective、Retrieval evidence objective 与 Recommendation personalized decision objective 分离；
- canonical resolution、evidence/citation lineage、partial failure 与 bounded execution；
- lexical、semantic/vector、graph、structured/domain 与 Memory modes 的可组合性；
- derived cache/index 可失效、可删除传播、可重建且不拥有 truth；
- MVP 最低复杂度，以及未确定的 volume、SLO、provider、model、engine 与 topology。

## Options

### A. Retrieval inside AI Runtime

调用路径短，但 AI Runtime 会吸收 source integration、permission、index、fusion 与 evidence lifecycle；非 AI Search 复用困难，并可能把 model execution 误变成 information authority。Reject。

### B. Retrieval inside Search

适合 user-facing query，却会让 evidence gathering、Memory access、RAG grounding 与 planning 被 Search ranking/output contract绑架。Reject。

### C. Independent Retrieval service/bounded context

复用和隔离清晰，但当前没有独立 business truth、规模/SLO/team evidence；提前建立 service 会造成 platform-first complexity。Future option，不作为 MVP requirement。

### D. Shared logical Retrieval capability，Application/shared module orchestration over typed source ports

统一 request-time planning、hard filtering、normalization、dedup/fusion、reranking 与 evidence packaging，同时让 source domain 保持 truth/access policy。MVP 可为隔离 module，未来按 workload evidence 抽离。Recommend。

## Recommendation

1. Search 是 product/application-facing query capability，拥有 request-scoped `SearchResult` ranking、grouping/blending decision，但不是 business bounded context，也不拥有 object truth。
2. Retrieval 是 shared logical information-access capability，不是 business truth owner。MVP 推荐由 Application/shared module 实现，不要求独立 service。
3. Application owns authoritative `IntentDecision`、use-case goal、business constraints、expected outcome，以及不可扩大的purpose、source/capability/tool allowlists、permission envelope、hard constraints和policy/business budgets。`QueryInterpretation` 只解释如何满足已授权use case，不得替换Chapter 5 intent authority。
4. `RetrievalPort` 接收 typed `RetrievalRequest`，在授权envelope内形成`QueryInterpretation`与bounded `RetrievalPlan`，调用permitted typed source ports，并返回request-time `RetrievalResult`。
5. Source domains 保持 authority：Catalog canonical truth；Physical/Live current domain observations；Knowledge claims；Memory access policy；Personalization/Taste interpretation。Retrieval 不直接读取 unrestricted stores。
6. `RetrievalResult` 分离`RetrievedReference`/`CandidateReference`和`RetrievalEvidence`：前者是typed canonical candidate/navigation/lookup reference，后者支持factual/interpretive claims并保留provenance/citation/rights/limitations；两者都不是新truth。
7. Cross-authority graph traversal 使用 `MusicGraphQueryPort` / `MusicRelationshipView`；Knowledge-specific claim/evidence 使用 `MusicKnowledgePort`；Memory 仅通过 `MemoryAccessPort`；Taste 仅通过 typed Personalization contract。
8. Hybrid Retrieval 是按 use case 组合 exact/canonical、lexical、semantic/vector、graph、structured/domain 与 policy-mediated Memory modes；vector 只是 semantic retrieval 的可能 implementation。
9. Hard permission、`EvidenceUsagePolicy`、region/source/canonical/safety constraints在ranking前执行且reranker不得复活被过滤candidate。Usage policy区分retrieval/index、model-context、derivative/summarization、quote/display、citation/attribution、region与expiry/withdrawal。
10. Retrieval ranking 回答“哪些 permitted references/evidence 对本任务最有用”；Search ranking 回答“用户应看到哪些 search results”；Recommendation 保留 personalized final decision authority。分数不得跨目标自动成为 truth。
11. AI Runtime 可在delegated envelope内normalize query、提出受限plan、选择subset/order、构造typed request、执行configured reranking/summarization和`ModelExecutionContext`；不得创建authorization、扩大access、重解释denial、发明ID/证据、改变provenance或持久化result为domain truth。
12. Citation lineage是many-to-many：generated claim可由多个`RetrievalEvidence`支持，同一evidence也可支持多个claims；必须保留provenance、source class、usage rights、freshness与limitations。
13. Cache、lexical/vector/autocomplete/entity indexes 与 graph projection 都是 rebuildable derived projections，必须支持 authority/version reference、invalidation、rights/permission removal 与 deletion propagation。

## Trade-offs

- 接受 Application/shared Retrieval module 与多个 typed source ports 的 orchestration complexity，换取 authority、privacy 与 reuse 清晰。
- 接受跨 source normalization/fusion 和 partial-result contract，换取多源 resiliency 与 traceable evidence。
- 接受 Search、Retrieval 与 Recommendation 分别维护 ranking objective，换取不把 relevance score误用为 personalized truth。
- 暂不建立独立 Retrieval service，降低 MVP operations，但未来若 workload/team边界成立需要可提取模块。

## Consequences

- Chapter 4 将 Search 定位为 product/application capability，将 Retrieval 定位为 shared logical technical capability；两者都不是新 business BC。MVP physical colocation不改变Application与Retrieval logical responsibility separation。
- Chapter 9 定义 logical query/planning/evidence/fusion/reranking contracts；Chapter 15 才细化 components/interfaces，Chapter 16/22 才选择 physical indexes与technology。
- RAG = Retrieval + grounded evidence packaging + generation；不等于 vector DB、embeddings、Search 或 LLM Memory。
- Required/optional source、partial result、budgets、reference/evidence separation、many-to-many citation lineage与stale limitation成为contract requirements。
- Provider/search/vector/reranker/embedding vendor/model、final index schema、ranking formula、numeric thresholds 与 service topology均未接受。

## Deferred Decisions

- final Search scopes、MVP modes/sources/vector need、graph traversal depth：OQ-002 / Chapter 24；
- provider contracts、rights、quotas、fallback、freshness：OQ-006/OQ-008 / Chapter 10；
- logical/physical data and index schema、citation persistence：Chapter 11；
- permission/privacy/safety policies：Chapters 12/18；
- API/streaming/partial events：Chapter 14；
- component/interface detail：Chapter 15；
- cache/search/vector/index/storage topology：Chapter 16；
- SLO、timeout、degradation：Chapter 17；
- ranking/reranking/evidence/citation evaluation thresholds：Chapter 19；
- search engine、vector store、embedding/reranker model/vendor：Chapter 22。

## Revisit Conditions

- Retrieval workload、SLO、team ownership 或 change cadence证明需要独立 deployable/service；
- permission/region/rights isolation不能由 shared module安全满足；
- source count、fan-out、index scale 或 async pipeline使当前 orchestration不可维护；
- evaluation 显示 current fusion/reranking contract无法满足 product quality；
- MVP scope显著改变 required sources/modes。
