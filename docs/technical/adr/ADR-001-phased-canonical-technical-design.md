# ADR-001 — Canonical Technical Design 的分阶段维护方式

> 分类：Architecture Governance  
> 状态：Accepted

## Context

Yara 已完成复杂的 cross-platform Product Design。Technical Design 涉及 System、Domain、AI、Data、Integration、Infrastructure 与 MVP roadmap。如果一次性生成全部内容，早期未审查假设会在后续章节被放大。

## Requirements / Constraints

- 保持一个 canonical `Yara-Technical-Design.md`；
- 每个 Phase 必须形成可审查的 Decision Summary；
- major decision 使用 ADR；
- 未批准 Phase 不得成为后续实现约束；
- 不创建相互漂移的多份架构主文档。

## Options Considered

### Option A — 一次性完成全部 Technical Design

Pros：

- 初始输出速度快；
- 能快速获得形式完整的文档。

Cons：

- 未决问题会被包装成确定结论；
- decision dependency 难以审查；
- 修改早期假设会造成大面积返工；
- 容易提前技术选型。

### Option B — 每个领域维护独立主文档

Pros：

- 团队可并行编辑；
- 单个文件更小。

Cons：

- terminology、scope 与 cross-domain contract 容易漂移；
- 很难判断哪个文档是最终 truth；
- Review 需要跨文档重建上下文。

### Option C — 单一 canonical 文档，按 Phase 增量写入，ADR 独立记录

Pros：

- 保持一条可追踪的 architecture narrative；
- 每个 Phase 可独立 Review/Approve；
- ADR 提供稳定 decision history；
- 降低前置假设扩散风险。

Cons：

- 需要严格维护状态与链接；
- 主文档会逐步变长；
- Phase 间必须管理 unresolved dependency。

## Decision

选择 **Option C**。

本 ADR 属于 **Architecture Governance**。

状态：**Accepted**。

## Why

Yara 的核心技术风险来自跨域语义一致性，而不是单个组件的局部实现。单一 canonical 文档能维持 Context、Memory、Recommendation、Music Object、Community 与 Provider 的共同语言；分阶段 Review 可以避免未经批准的实现假设进入后续设计。

## Trade-offs

- 接受更严格的 Phase gate 与文档维护成本；
- 换取 decision traceability、较低返工风险和清晰的 source of truth。

## Consequences

- 每个 Phase 结束后必须停止并等待 Review；
- ADR 可独立演进，但必须由主文档链接；
- Open Question 必须显式标注 blocking scope；
- 不允许创建第二份平行的 Technical Design 主文档。

## Revisit Conditions

- 团队规模扩大，需要多个 owner 并行维护；
- 文档体量导致 review tooling 无法有效工作；
- authoritative TOC 要求拆分，但仍需保留一个 canonical index 与 decision graph。
