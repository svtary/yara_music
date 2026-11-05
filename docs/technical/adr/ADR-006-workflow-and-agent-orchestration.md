# ADR-006 — Workflow-first with Selective Agent Orchestration

> 分类：AI Architecture  
> 状态：Accepted

## Context

Yara 的大部分 product tasks 有已知语义、可枚举状态与 typed result；少数 provider-heavy research 可能需要根据中间 observations 动态选择下一步。把所有请求交给 Agent 会降低可预测性、可恢复性与 write safety。

## Options

### A. Workflow Only

可预测、可测试、状态清晰；对真正开放的 provider/source exploration 不够灵活。

### B. Agent-first

动态规划能力强；但 step/tool/cost 不确定，难以保证 permission、idempotency、recovery 与 result contract。

### C. Workflow-first + Selective Controlled Agent

使用 predefined Workflow 管理主 task lifecycle；仅在 dynamic planning/tool choice 必需的 bounded subproblem 中启用 Agent，并施加 allowlist、step/time/cost budgets、stop conditions 与 typed observation validation。

## Decision

选择 C。Album explanation、standard RAG、Recommendation pipeline 不使用 autonomous Agent。Concert Planning、Vinyl Comparison、Playlist Building 均 Workflow-first；只有局部 source/provider path 无法预定义时使用 controlled Agent。

Application Layer 保持 business use-case selection、cross-domain sequencing、business constraints、allowed capabilities/actions 与 expected outcome；AI Runtime 在这些 delegated constraints 内选择并执行 Workflow/RAG/controlled Agent mechanics。Agent 不扩大 permission、不改变 product outcome，也不直接写 domain truth。

`AgentRuntimePort`是Yara-owned、framework-neutral的受控Agent execution边界；它与`ModelProviderPort`分离，并允许controlled TypeScript runtime、modern Agent SDK adapter或eligible China-compatible runtime adapter在不改变authority的前提下替换。Runtime adapter可协调bounded planning、typed tools、`AgentSession`、Guardrails、HITL suspend/resume与trace，但不得拥有Domain truth、Consent/rights、business transaction、Memory、YaraTask或committed `StructuredResult`。该补充只现代化实现边界，不改变Workflow-first + selective Controlled Agent决策。

## Consequences

- Application/YaraTask 声明 business goal 与 expected/allowed result types；Runtime `AIExecutionPlan` 与 `AIExecutionRun` metadata 可观察，但不记录 private chain-of-thought；
- 一个 `YaraTask` 可关联多个非产品可见 `AIExecutionRun`，用于 retry/fallback/resume/alternate strategy；
- Agent steps 通过 Tool Registry/Policy Guard；
- Agent runtime通过`AgentRuntimePort`接入；SDK/provider session仅是可替换execution metadata，`AgentSession != YaraConversation != YaraTask != Memory`；
- SDK approval必须映射到既有`RequiredAction` / confirmation / re-auth / `ManualReviewRequired`；
- recovery 从允许的 checkpoint/typed observations 恢复；partial/progress/tool status 是 Running events，不是 primary `YaraTask` state；
- P0不依赖Agent framework；P1 adapter/PoC必须用同一evaluation harness证明收益，不获得新的authority。

## Revisit Conditions

- use case 的 dynamic planning value 可被 evaluation 证明；
- provider variability、latency 或 failure model 改变；
- workflow proliferation 或 Agent failure rate 超出可接受范围。
