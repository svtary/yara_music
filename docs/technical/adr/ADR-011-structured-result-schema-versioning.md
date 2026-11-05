# ADR-011 — Structured Result Schema & Versioning Positioning

> 分类：AI Architecture  
> 状态：Accepted

## Context

Yara 的 Music Recommendation、Music Explanation、Playlist、Concert Plan、Vinyl Comparison、Taste Match 与 Journey Reflection 是 first-class structured outputs，而不是 generic chat text。Free-form model output 不能直接成为 durable client/domain contract。

## Options

### A. Free-form text contract

灵活，但无法稳定验证 references、citations、partial state、client rendering 或 compatibility。

### B. One universal rigid schema

治理简单，但会丢失各 result type 的 semantics，并形成大量 optional fields。

### C. Versioned result envelope + typed result schemas

共享 lifecycle/provenance/version envelope；每种 result type 使用独立 typed blocks/schema，并通过 validation pipeline 产生。

## Decision

选择 C。Yara Interaction/product contract 拥有 result taxonomy；Application Use Case / `YaraTask` 声明 `expectedResultType` 或 `allowedResultTypes`。Structured Result Engine 不得发明或自由选择 product result type，只负责 typed composition、schema validation、domain reference validation、claim/citation binding、safety/permission validation、bounded repair、partial/failure handling 与 version-identifiable delivery。

Free-form model output 只是待验证 input。最终 result JSON schemas、API/event contracts 与 compatibility policy deferred to Chapters 11/14/15。

## Consequences

- client 可按 `resultType` + schema/contract version 安全渲染；
- invalid/unsupported blocks 必须 repair、omit、mark partial 或 fail；
- `StructuredResult != chat message`，`SavedResult != CollectionItem`；
- schema version 与 prompt/workflow/tool/validator versions 进入 trace；
- 不在本 ADR 决定 storage schema 或 serialization technology。

## Revisit Conditions

- result taxonomy 改变；
- client compatibility 或 partial-update semantics 改变；
- API/schema governance 在 Chapters 14–15 形成更严格约束。
