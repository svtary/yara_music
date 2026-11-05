# ADR-005 — Hybrid Intent Router

> 分类：AI Architecture  
> 状态：Accepted

## Context

Yara 同时支持显式 task entry、自然语言提问、object-context ask 与多轮 conversation。Yara Interaction/Application 拥有 Find/Understand/Recommend Music、Concert Planning、Vinyl Comparison、Playlist Building、Journey Reflection 与 General Music Q&A 等 product/business Intent taxonomy；AI Runtime 只对该 taxonomy 执行 inference，同时不能获得 tool/write authority。

## Options

### A. Rules Only

Deterministic、低成本、易审计；但 paraphrase、ambiguity 与新表达覆盖不足，规则会快速膨胀。

### B. Model Classification

语言覆盖和泛化较强；但引入 nondeterminism、latency/cost、prompt injection 与 confidence calibration 风险。

### C. Hybrid Routing

显式入口、高置信结构化输入与 safety rules 优先；复杂自然语言使用 model-assisted classification；最终由 deterministic policy gate 检查 confidence、context、permission 与 allowed execution strategies。

## Decision

选择 C。Runtime Router 输出 typed `IntentInference`，包含 taxonomy version、intent candidates、confidence band、resolved context、missing information 与 ambiguity indicators。Application 结合 product rules 产生 authoritative `IntentDecision`、clarification requirement、business constraints、allowed capabilities/actions 与 expected product outcome。

低置信、冲突 intent、缺少 required context 或高风险 action 必须 clarify/fail closed。Classifier 不得定义新 authoritative intent、调用 tools、执行 domain command 或拥有 `YaraTask`。

## Consequences

- 需要 versioned taxonomy、golden intent set、confidence calibration 与 routing evaluation；
- rules 与 model decision 都产生 policy-safe trace；
- Application 决定 business use case 与 delegated constraints；AI Runtime 在约束内选择 Workflow/RAG/controlled Agent 等 execution strategy；
- 不选择 classifier model、vendor 或 framework。

## Revisit Conditions

- intent taxonomy 或 product task families 改变；
- evaluation 显示 rules/model split 不再有效；
- latency、cost、privacy 或 safety constraints 改变。
