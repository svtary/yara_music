# ADR-002 — Full Vision 与 MVP 的双架构视图

> 分类：Architecture Strategy  
> 状态：Accepted

## Context

冻结 Figma 表达 Yara 的完整 cross-platform product vision。当前没有证据表明全部 39 个 canonical page semantics 都属于 MVP。若把完整设计直接等同 MVP，会过度建设；若只设计临时 MVP，则可能破坏 canonical identity、Context/Memory 边界与未来扩展路径。

## Requirements / Constraints

- 完整产品能力必须在目标 Technical Design 中有明确归属；
- MVP 只能包含已批准 capability slice 所需的最小复杂度；
- MVP 与 Full Vision 共享已冻结的 product semantics；
- MVP 的模型与接口必须具备面向 Full Vision 的可演进路径，但是否共享同一 physical model、API 或 deployment contract 由后续 ADR 决定；
- 不提前选择具体 infrastructure。

## Options Considered

### Option A — 只设计 Full Vision Architecture

Pros：

- 架构覆盖完整；
- 长期能力关系清晰。

Cons：

- 容易把未来需求变成 Day-1 infrastructure；
- MVP 成本、风险与交付顺序不清晰。

### Option B — 只设计独立 MVP Architecture

Pros：

- 聚焦首发；
- 短期实现简单。

Cons：

- 可能忽略冻结产品的长期 invariant；
- 容易形成 provider-bound entity、generic chat result 等技术债；
- 后续迁移成本不可见。

### Option C — 同一 Technical Design 内维护 Full Vision 与 MVP Implementation 两个视图

Pros：

- 同时控制长期语义完整性与短期复杂度；
- 能明确哪些组件 logical-only、哪些在 MVP materialize；
- migration 与 revisit condition 可被审查。

Cons：

- 文档需要持续标注 view；
- 若 MVP scope 未确认，部分 decision 只能保持 conditional。

## Decision

选择 **Option C** 作为 architecture strategy。

状态：**Accepted**。

## Why

Yara 的完整产品愿景包含 Music Graph、Recommendation、Memory、Community、Human Messaging 与多种 provider integration，不能全部假设为首发基础设施。同时，canonical music identity、typed Structured Result、Context/Memory separation 等原则必须从 MVP 第一版成立。

## Trade-offs

- 接受文档中维护两种视图的额外认知成本；
- 换取可控的 MVP scope、明确的演进路径和更少的不可逆技术债；但本 ADR 不提前批准具体 API compatibility mechanism。

## Consequences

- 后续每个重要章节应标注 Full Vision 与 MVP Implementation 差异；
- MVP architecture 只能在 OQ-002 关闭后最终批准；
- specialized infrastructure 必须由 MVP requirement 证明必要性；
- Full Vision logical component 不代表 MVP 独立 deployment unit。

## Revisit Conditions

- MVP capability、market 与 provider scope 已正式批准；
- 业务策略改为一次性交付完整 vision；
- 某项 Full Vision invariant 被产品决策明确取消。
