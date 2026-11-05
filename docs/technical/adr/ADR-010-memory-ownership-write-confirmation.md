# ADR-010 — Memory Ownership, Write Policy, Confirmation & AI Boundary

> 分类：Personal Intelligence Architecture  
> 状态：Accepted

## Context

Yara 需要跨 session 的长期 companion recall，但冻结产品语义要求 `Taste != Memory`、`Journey != Memory`、`ConversationHistory != Memory`、`SessionContext != Memory`。Memory 还必须支持透明 confirmation、Why This、Edit 与 Forget，同时避免 AI Runtime 或 LLM 静默建立不可控的 private user model。

本 ADR 决定 logical ownership、初始 write/confirmation policy 与 AI authority boundary，不决定 physical storage、retrieval algorithm、retention duration、model、framework 或 deployment topology。

## Decision Drivers

- durable cross-session utility 与最小必要性；
- 单一 authoritative write authority；
- user trust、surprise、edit/forget/reset；
- provenance、temporal validity、conflict/supersession 与 consolidation；
- durable companion-memory authority 与 referenced domain fact authority 的分离；
- candidate lifecycle 与 record lifecycle 的分离；
- purpose/permission、privacy、retention 与 deletion propagation；
- 与 Taste、Journey、Conversation、Task 和 source-domain truth 分离；
- Application Layer coordination 与 AI Runtime non-authority；
- MVP 可在 consolidated topology 中保持 logical isolation。

## Ownership Options

### A. Yara Interaction owns Memory

接近 conversation source，但会把 durable private state 与 interaction lifecycle 耦合，使非 conversation use cases 依赖 Yara Interaction。拒绝。

### B. PERSON owns Memory

与 user data 相邻，但 Identity/Profile 不应承担 candidate extraction、confirmation、conflict、expiry、consolidation 与 retrieval policy 的独立 lifecycle。可行但不优先。

### C. Independent Memory logical bounded-context candidate

Memory 拥有 candidate evaluation、decision、record/version、conflict/supersession、consolidation、access projection 与 forget lifecycle；通过 typed references 访问 source truth。推荐。

### D. Memory inside Personalization

部署可能共享，但 logical ownership 会模糊 Taste 与 general companion facts，增加 preference duplication 风险。拒绝作为 logical model。

## Write Policy Options

| Option | Benefit | Risk | Assessment |
|---|---|---|---|
| Explicit-only | trust最高、简单 | companion utility受限、用户摩擦高 | Viable fallback |
| Explicit + inferred confirmation | 可控且允许智能建议 | confirmation friction | Strong baseline |
| Risk-tiered automatic inference | 低摩擦 | surprise、false inference、classification与retention burden | Premature |
| Context-specific hybrid | explicit direct、inferred confirm、prohibited reject | 需要 policy matrix | Recommend |

## Recommendation

1. Memory 是 independent logical bounded-context candidate；不等于独立 service、database 或 deployment。
2. Memory 对“某信息已按给定 scope、provenance、validity 与 access policy 被接受为 durable companion memory”具有 authority。`MemoryRecord authority != Referenced domain fact authority`。
3. Memory owns `MemoryCandidate` evaluation、`MemoryDecision`、`MemoryRecord`、`MemoryVersion`、`MemoryConflict`、`MemoryConsolidation`、`MemorySnapshot` 与 edit/forget semantics。`MemoryCandidateStatus` 与 `MemoryRecordStatus` 分离；candidate `ACCEPTED` 后才创建或更新 record。
4. Source domains 保留 underlying fact truth；Memory 优先保存 typed references + companion semantics，不复制 Identity/Profile、`TasteProfile`、Journey、Live、Collection、Conversation History、Task state 或 canonical domain facts。仅无其他 domain owner 的 companion-specific fact/constraint 可由 Memory 拥有 normalized proposition。
5. Clear explicit “remember this” command 在 permission、scope、meaning 与 policy 均可验证时可令 candidate `ACCEPTED` 并创建/更新 `ACTIVE` record，无需冗余二次确认，并必须提供可见、可撤销结果。
6. 所有 inferred durable `MemoryCandidate` 默认进入 `AWAITING_CONFIRMATION`；未确认不得成为 active Memory。当前不允许 silent low-risk inferred durable writes。
7. Explicit statement 使用 source authority、scope 与 validity，不分配 arbitrary model confidence；`MemoryConfidence` 与 `minimumDerivedConfidence` 仅适用于 inferred candidate/record。
8. Prohibited source/classification、缺少 permission/provenance 或超出 purpose 的 candidate 直接拒绝，不能靠用户 confirmation 绕过基础 policy。
9. Conflict 仅在相同 semantic key、overlapping scope/conditions/qualifiers/time 且 propositions 互斥时成立；条件不同的 records 可以同时 active。相同适用条件和 validity window 下的互斥 propositions 不得保持 equally active。
10. Application/Memory policy owns durable write decision。AI Runtime/LLM 只能提出 `ProposedMemoryCommand`、分类、检测 conflict、建议 consolidation 或 verbalize validated explanation。
11. `MemoryAccessPort` 只返回 purpose/scope/class/time/assertion-mode/relevance-filtered `MemorySnapshot`/references，并仅对 inferred state 应用 derived-confidence gate；不向 LLM 暴露 unrestricted store。
12. Forget 从 future companion recall/use 移除 Memory；Delete 按 retention/privacy/legal policy 移除数据。`FORGOTTEN` 不自动定义 physical deletion，后者 deferred to Chapter 18 / OQ-009。

## Trade-offs

- 接受 inferred memory 的 confirmation friction，换取信任、可审计性与更低 surprise。
- 接受独立 logical contracts 与 cross-domain references，换取清晰 authority 和 deletion semantics。
- MVP 可以同 runtime/store 部署，但必须保持 module/API/dependency isolation。
- 不使用 silent automatic inference 会降低短期“聪明感”，但避免在 policy、quality 与 legal evidence 不足时积累不可控长期状态。

## Consequences

- Chapter 4 将 Memory 更新为 strong independent logical bounded-context candidate；
- `MemoryStore != YaraContext`，每次 use case 只获取 permitted snapshot；
- `TasteProfile` 与 Journey facts 不在 Memory 中建立重复 authority；
- candidate 与 record 使用独立 status/lifecycle；record 需要 scope/qualifiers、temporal validity、assertion mode、source/provenance、decision/policy version 与 version lineage；
- explicit source authority 与 inferred confidence 分离；
- contradiction 必须按 overlapping applicable conditions 处理；条件化 memories 可共存，互斥且同条件的 records 必须 resolve/defer/supersede；
- edit/forget/reset/source deletion 必须传播到 derived retrieval indexes；
- `FORGOTTEN` 只定义 recall/use state，不替代 Chapter 18 的 physical deletion policy；
- Private Messaging 与 Social content 不作为默认 Memory sources；
- explanation 必须 grounded 且不暴露 chain-of-thought。

## Deferred Decisions

- data classification、sensitive/high-impact definition 与 regional rules：OQ-004 / Chapter 18；
- record/evidence retention、export/delete期限与例外：OQ-009 / Chapters 11/18；
- AI training/quality-improvement use：OQ-012 / Chapters 18/19；
- confirmation/edit/forget UX 与 transport contracts：Chapters 12/14；
- retrieval/ranking/index/embedding method：Chapter 9；
- database、vector store、encryption、partition 与 deployment topology：Chapters 16/22/24；
- confidence、importance、staleness 与 consolidation thresholds：Chapters 19/22。

## Revisit Conditions

- product/privacy evidence supports a narrowly defined automatic inferred-memory class；
- independent scale、SLO、team ownership 或 regulatory isolation requires physical extraction；
- confirmation burden materially harms utility without improving trust；
- conflict/deletion/retrieval evidence shows the logical boundary is too broad or too narrow；
- a source domain gains an authoritative semantic that currently exists only in Memory.
