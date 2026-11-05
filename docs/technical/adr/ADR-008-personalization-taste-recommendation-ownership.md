# ADR-008 — Personalization / Taste / Recommendation Ownership & LLM Boundary

> 分类：Personal Intelligence Architecture  
> 状态：Accepted

## Context

Yara 在 Home、Explore、Yara conversation、related music、Concert 与 Physical Record 等 surfaces 使用相同用户 Taste，但各 source domain 继续拥有 Collection、Journey、Playback、Search、Social 与 interaction facts。需要确定 `TasteProfile` 的 authoritative logical owner、Personalization/Recommendation 的关系，以及 LLM 的允许边界。

## Decision Drivers

- `Taste != Memory != Journey != Conversation History != Session Context`；
- `Recommendation != LLM-generated list`；typed candidate 必须解析到 Catalog、Live 或 Physical 的适用 canonical reference；
- explicit 与 implicit evidence 需要 provenance、permission、decay、correction、reset 与 deletion propagation；
- persistent Taste 和 request-time Context 生命周期不同；
- non-Yara surfaces 也需要 personalization；
- logical ownership 不应提前决定 service、database、model 或 deployment。

## Options

### A. Taste owned by PERSON

语义接近个人身份，但会扩大 Identity/Profile scope，把 derived-model lifecycle、evidence policy 与模型迭代耦合到 PERSON general identity。

### B. Taste owned by YARA Interaction

Conversation 使用直接，但会把 durable preference authority 耦合到 AI interaction，使 Home/Explore/related surfaces 反向依赖 Yara Conversation semantics。

### C. Independent Personalization logical boundary owns Taste

Personalization 解释 permitted signals，分别拥有 user-authored `ExplicitPreferenceState` 与 inferred `DerivedTasteState` semantics，并提供保留 origin 的 `TasteProfile` combined view 与 permission-filtered `TasteSnapshot`；source domains 保持 source truth。Recommendation 作为该 logical boundary 内部 capability/module，通过 TasteSnapshot/context/constraints 进行 decision。

### D. Split explicit preferences and derived Taste ownership

PERSON 拥有 explicit、Personalization 拥有 derived。虽然来源区分明显，但同一 facet 会产生双 authority、merge/conflict/reset 和 consumer composition 问题，除非未来法律或产品证据要求，不采用。

## Trade-offs

| Concern | Option C consequence |
|---|---|
| Semantic clarity | signals/evidence/profile/update/snapshot 使用一致语言与单一 write authority |
| Privacy/user control | purpose、provenance、correction、reset、deletion 可在同一 logical boundary 执行 |
| Coupling | source domains 只发布 permitted references/events；Yara Interaction 不拥有 Taste |
| Recommendation | 复用 TasteSnapshot；decision lifecycle 在 Personalization boundary 内由独立 module 管理，暂不形成独立 BC |
| MVP complexity | 可在 consolidated runtime/database 中作为隔离 module，不要求独立 service/store |
| Evolution | model/policy cadence 可独立演进；exact BC/deployment boundary later validated |

## Recommendation

采用 Option C 的 logical ownership：

1. Personalization 是 logical bounded-context candidate，并作为 durable music preference semantics 的 authoritative logical owner。
2. Personalization 在同一 ownership boundary 内分别拥有 user-authored `ExplicitPreferenceState` 与 inferred `DerivedTasteState`；`TasteProfile` 是保留二者 origin 的 combined view，`TasteSnapshot` 是 request-time permission-filtered projection。不得将 explicit state 降格为 inference，也不得创建两个 owners。
3. `TasteEvidence` 仅在 signal-specific purpose/privacy/retention policy 允许时保留，并支持 decay、deletion propagation、reset、permission withdrawal 与适用时 re-derivation；最终 retention 由 Chapter 18 / OQ-009 决定。
4. Recommendation 初始为 Personalization logical boundary 内部 capability/module，负责 typed candidate generation coordination、surface-specific eligibility、ranking、contextual adjustment、diversity/novelty、validated explanation rationale 与 recommendation feedback interpretation。
5. `RecommendationCandidate<TCanonicalReference>` 可引用 `MusicObjectRef`、Event/Occurrence reference 或 Physical Release/Edition/Pressing reference；Catalog、Live、Physical 保持 authoritative ownership。共享 pipeline 不要求 candidate-type-specific eligibility/ranking features 相同。
6. Recommendation 只有在未来出现独立 lifecycle、invariants、scale、operational SLO、change cadence 或 ownership evidence 时才重新评估为独立 bounded context；physical service/database/model/deployment topology deferred。
7. LLM 不拥有或直接写 Taste，不生成 candidate truth，不覆盖 permission、surface-specific eligibility 或 hard constraints；只能解析/标注 permitted inputs 或 verbalize validated rationale。

## Consequences

- Chapter 4 将 Personalization/Taste 从 unresolved ownership 更新为 strong logical BC candidate/authoritative logical owner，并将 Recommendation 标记为其内部 capability/module；
- source-domain event 与 `PreferenceSignal`/`TasteEvidence` 必须区分并保留 provenance；
- explicit preference 与 derived Taste 必须在 state、visibility、correction 与 explanation 中保持可区分；
- `TasteEvidence` 不得被假设为永久保留；
- `PersistentTaste != TemporaryContextualPreference`；Context 不自动写 Taste；
- typed RecommendationCandidate 必须 canonical-resolved；surface/use-case hard eligibility 永远优先于 ranking；
- explanation 只能使用实际用于 decision 且允许披露的 evidence；
- reset/deletion/permission withdrawal 必须传播到 evidence、profile projections 和 future decisions；
- 不选择 algorithms、features、embedding、ML framework、storage、service 或 deployment topology。

## Deferred Decisions

- Recommendation 未来是否因独立 lifecycle/invariants/scale/SLO/change cadence/ownership 证据抽离；当前不作为独立 BC；
- Personalization/Recommendation physical service、database 与 deployment materialization；
- signal retention、consent、social-input policy：OQ-004/009/011；
- explanation coverage：OQ-014；
- ranking、decay、exploration formulas 与 models：Chapters 19/22；
- physical data/API/event contracts：Chapters 11/14/15；
- MVP capability/materialization：Chapter 24 / OQ-002。

## Revisit Conditions

- explicit preference 产生必须独立于 derived Taste 的法律 authority；
- Recommendation lifecycle/scale/team cadence 证明独立 BC；
- privacy/regional rules 要求不同 isolation；
- profile correction/reset 或 cross-domain coupling 证明当前 boundary 过粗或过细。
