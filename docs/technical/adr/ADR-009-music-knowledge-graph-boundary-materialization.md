# ADR-009 — Music Knowledge Ownership, Logical Graph & MVP Materialization

> 分类：Music Intelligence Architecture  
> 状态：Accepted

## Context

Yara 需要为 music understanding、discovery、Recommendation、Search/Retrieval 与 grounded AI 提供 influence、sample、genre/scene、credit、collaboration、similarity 等关系。Catalog 已拥有 canonical identity/structural truth，而多源 knowledge claims 具有不同 provenance、confidence、temporal validity、rights 与 disagreement semantics。需要决定 Knowledge/Catalog ownership、Graph 的 logical meaning，以及 MVP 是否需要 dedicated Graph DB。

## Decision Drivers

- Catalog canonical identity 与 structural invariants；
- sourced/editorial/inferred claim 的 provenance、conflict、temporal 与 rights lifecycle；
- Recommendation、Retrieval 和 AI Runtime 的共享 typed access；
- provider observations 与 Yara canonical state 的 anti-corruption boundary；
- derived relationship/embedding projection 的 rebuildability；
- MVP one-hop/two-hop use cases、operational simplicity 与未确认 scale/SLO；
- 避免 everything graph、AI-owned truth 和 technology-first boundary。
- 以 canonical structure necessity 区分 Catalog/Physical structural truth 与 Knowledge claim lifecycle；
- `KnowledgeClaim authority` 与 underlying real-world fact/source authority 必须分离。

## Ownership Options

### A. Knowledge inside Catalog BC

Identity reference简单，但会把 editorial/inferred claims、rights、dispute 和 high-change ingestion lifecycle 混入 structural Catalog invariants。拒绝作为最终 logical boundary。

### B. Independent Music Knowledge logical bounded-context candidate

Catalog 保持 identity/structural truth；Knowledge 拥有 normalized non-structural claims、relationship semantics、provenance/conflict/rights 与 derived projection policy。推荐。

### C. MUSIC-area capability with final split deferred

适合最小组织，但缺乏清晰 claim write authority。可作为实现形态，不作为最终 logical ownership model。

### D. Graph owned by AI Runtime

会让 technical execution capability 变成 music-world truth owner，并允许模型输出污染 authority。拒绝。

## Materialization Options

| Option | Strength | Cost/risk | Assessment |
|---|---|---|---|
| Relational only | 简单、一致、适合一至两跳与 provenance | deep traversal较弱 | Viable MVP baseline |
| Relational authority + derived graph projection | stable truth + rebuildable traversal view | invalidation complexity | Recommend |
| Dedicated Graph DB | deep/dense traversal expressive | new operations/consistency/tooling | Deferred pending evidence |
| Graph/search/vector hybrid | heterogeneous retrieval | highest complexity/evaluation burden | Future option |

## Recommendation

1. Music Knowledge 是 MUSIC area 内的 strong independent logical bounded-context candidate。
2. Catalog owns canonical MUSIC identity、provider mappings，以及 identity、composition、membership、version lineage、release structure 和 normalized primary structural metadata 所必需的 structural facts；Physical/Live 保持各自 canonical authority。
3. Knowledge owns sourced/disputable、editorial/interpretive、contextual、temporally qualified、model-derived 或 provenance-heavy claim 的 normalized lifecycle、provenance、conflict、rights 与 derived policy。
4. `KnowledgeClaim authority != Underlying real-world fact authority`；Knowledge 的 authority 限于 claim acceptance/classification/provenance/qualifiers/conflict/rights/derived policy，provider、editorial 或 licensed source 仍可能是事实 source authority。
5. Music Graph 是 MUSIC-area cross-authority logical relationship read projection，不是独立 business domain、AI Runtime capability 或 physical database definition。Knowledge governs knowledge relationship semantics、claim/provenance exposure、graph-oriented query contract 与 derived projection policy，但 Graph inclusion 不转移 authority；每条关系的 authority 等于 underlying source domain / claim authority。
6. Provider payload、LLM output 和 derived edge 不直接成为 authoritative claim。LLM 只能提出 `LLMRelationshipCandidate`，经过 provenance、canonical resolution、rights 和 validation 后才能产生 Knowledge decision。
7. MVP 采用 relational normalized claim/relationship materialization，并只为已证明 query 构建 rebuildable projection；不要求 dedicated Graph DB。
8. `MusicKnowledgePort` 只提供 Knowledge-owned claims/evidence/concepts；`MusicGraphQueryPort` 通过 non-authoritative `MusicRelationshipView` 提供 cross-authority traversal。该 facade 不创建 write authority，也不把 Catalog/Physical structural relationships转换为 `KnowledgeClaim`。Recommendation、Search/Retrieval 与 AI Runtime 保持各自 ranking/execution authority。
9. `KnowledgeClaim` 是 generic normalized envelope；`RelationshipAssertion` 是 object 指向 canonical/concept ref 的 graph-facing specialization。`KnowledgeConcept` 由 Yara control/version，provider terms 通过 versioned `ProviderConceptMapping` 表达 exact/ambiguous/one-to-many/unresolved，不能自动 canonicalize。
10. canonical normalized credits 由 Catalog 持有；Knowledge 只引用。`collaborated_with` 优先从 credits 派生，仅在 credits 不足时作为独立 sourced claim。
11. Personalization、Memory、Journey 与 Social 不合并进 Music Knowledge Graph，只共享 canonical MUSIC references。Private/user-specific behavioral similarity 留在 Personalization / Recommendation；只有 aggregated、privacy-safe、non-user-identifying、purpose-approved、versioned、rebuildable 且 evaluated 的 music-world aggregate signal 才可成为 Knowledge derived relationship。
12. Recommendation output 不自动回写为 Knowledge similarity，避免 self-reinforcing feedback loops。
13. MVP 分开表达 Graph Structural Inputs（Catalog/Physical authority）与 Knowledge Claim Taxonomy；Chapter 24 可分别缩减。
14. Graph 可暴露 conflict/dispute/limitation 与 unresolved cross-authority inconsistency，但不成为 universal conflict-resolution authority；Catalog、Physical、Knowledge 分别解决其 authoritative state conflicts。

## Trade-offs

- 接受 Catalog/Knowledge 之间的 typed reference 与 ingestion coordination，换取清晰 authority。
- 接受 relational traversal 在深度/密度增长后的局限，换取 MVP 较低 operational complexity。
- 接受 derived projection invalidation/rebuild责任，换取 physical store 可替换性。
- 不把所有 provider disagreement压成单一 truth，换取 provenance、trust 与可解释性。

## Consequences

- Chapter 4 将 Knowledge 更新为 strong logical BC candidate；Graph 标注为 MUSIC-area cross-authority logical view/projection，并保留每条关系的 source authority。
- Canonical structural writes、Knowledge claim writes、editorial decisions、derived builds 与 LLM proposals 使用不同 authority paths。
- 所有 non-trivial assertions 需要 canonical refs、provenance、assertion class、temporal/qualifier、rights 与 conflict semantics。
- Similarity 必须保留 method/source/version，不存在 universal authoritative `similar_to` edge。
- MVP Graph Structural Inputs candidate 包含 canonical credits、part/version relationships 与 required Physical refs；MVP Knowledge Claim Taxonomy 的 Tier 1 candidates 包含 genre/subgenre、basic scene/era、sample/interpolation，Tier 2 evidence-dependent 包含 influence、derived collaboration、method-scoped similarity、movement/deeper historical relationships。Chapter 24 可分别继续缩减。
- Graph/read projection 在适用时逻辑保留 authority owner、assertion class、provenance、validity、rights/display、conflict 与 derivation metadata；不在本 ADR 定义 final schema。
- `MusicRelationshipView` 不成为新的 truth；`MusicGraphQueryPort` 不产生新的 write owner，physical materialization 继续 deferred。
- Editorial confidence、embedding similarity 和 provider factual quality 不假设同量纲；class-specific quality/ranking policy deferred to Chapters 9/19。
- provider correction、rights withdrawal、canonical merge 与 claim update 必须 invalidate dependent projections/indexes/explanations。
- Graph DB、query language、search/vector engine、schema、vendor 与 final ingestion infrastructure 未被接受。

## Deferred Decisions

- licensed providers、rights/display/attribution scope：OQ-006 / Chapters 10/18；
- MVP Graph Structural Inputs、Knowledge Claim Taxonomy、source set、data volume、traversal depth与SLO：OQ-002/OQ-008 / Chapter 24；
- unresolved relationship classification：保持 `classification pending under Chapter 8 ownership rule`；Chapter 11 仅在 semantic ownership 解决后定义 representation，不决定 domain ownership；
- graph/search/vector retrieval、ranking 与 query planning：Chapter 9；
- physical indexes、projection topology 与 dedicated graph trigger：Chapters 16/22；
- ingestion/event transport、refresh scheduling：Chapters 14/15/16；
- evaluation thresholds：Chapter 19。

## Revisit Conditions

- measured query workload requires deep/dense traversal beyond relational/projection SLO；
- relationship volume or update fan-out makes current materialization operationally unsafe；
- Catalog/Knowledge coordination shows incorrect ownership split；
- legal/licensing rules require stronger source isolation；
- team ownership/change cadence justifies physical extraction；
- MVP scope materially changes required taxonomy or ingestion sources。
