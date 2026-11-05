# ADR-004 — Capability-aligned Domain Boundaries & Ownership

> 分类：Domain Architecture  
> 状态：Accepted

## Context

Yara 的同一 MusicObject、user context 与 task lifecycle 会跨 Home、Explore、Yara、Community、Me 和 Player 出现。若按 navigation 或 Page ID 划分 backend ownership，会复制 canonical objects、制造循环依赖，并使 client composition 决定系统边界。

## Requirements / Constraints

- 保持 39 个 Page IDs 与 navigation semantics，但不将其映射为 services；
- canonical business facts 必须有明确 authoritative ownership；
- Human Conversation、Yara Conversation、Journey、Collection 与 Memory 保持冻结语义边界；
- domain boundary 必须由 invariant、lifecycle、ownership、consistency 与 ubiquitous language 推导；
- logical domain 不等于独立 deployment、database 或 team；
- MVP scope 未决时不引入不必要 distributed complexity。

## Options Considered

### Option A — Nine Flat Bounded Contexts

Pros：

- ownership labels 直接；
- 与 Chapters 4.1–4.9 的展示结构接近。

Cons：

- 把 Collection、Journey、Messaging 等 candidate status 过早冻结；
- 缺少 MUSIC/PERSON/YARA problem-space taxonomy；
- 容易被误解为 nine services/databases；
- 无法一致评价 Taste、Memory、Playback 等候选边界。

### Option B — Three Giant Bounded Contexts

Pros：

- boundary 数量少；
- Domain Area 内部协调直接。

Cons：

- MUSIC/PERSON/YARA 内部语言、privacy、lifecycle 与 scale 差异过大；
- 易形成 giant model 与 release coupling；
- Yara Interaction、Memory、Personalization 与 AI Runtime boundary 容易混合。

### Option C — Three Domain Areas with Nested Candidate Bounded Contexts

使用 MUSIC、PERSON、YARA / AI COMPANION 三个 primary business areas，并依据 ubiquitous language、invariants、lifecycle、write authority、consistency、change drivers、privacy/compliance 与 operational evidence 识别 candidate bounded contexts。YARA INTERACTION 当前只包含 Conversation & Context、Task、Structured Result candidates；Taste、Personalization、Recommendation、Memory 位于 Cross-domain Personal Intelligence。ADR-008 确定 Personalization 为 explicit/derived Taste semantics 的 authoritative logical owner，Recommendation 初始为其内部 capability/module；ADR-010 确定 Memory 为 independent logical bounded-context candidate。该方案不预先冻结 exact physical context/deployment count。

Pros：

- 与稳定业务语言、ownership 和 lifecycle 对齐；
- 分离 Domain Area taxonomy 与 implementation boundary；
- 同一能力可服务多个 product entry；
- 允许 MVP 在较少 deployable units 中实现，同时保留未来抽取边界；
- ownership-first，可保留 Music Catalog/Records、Journey/Memory、Yara Interaction/AI Runtime 等已证明的 semantic separations；
- Application Layer 执行 cross-domain orchestration，domain 与 runtime 不因协调关系获得他域 ownership。

Cons：

- 需要 module API、dependency rule 与 architecture test 防止边界腐化；
- 部分跨域 query 需要 read composition/projection；
- Recommendation、Playback、Memory 等边界需由专项章节验证；ADR-008/010 已解析 Recommendation 与 Memory logical placement，physical materialization 仍 deferred。

## Decision

选择 **Option C**：采用三个 primary business areas + candidate bounded contexts，并将跨域 Personal Intelligence 独立标注；保持 ownership-first、deployment-neutral decomposition。其内部 logical ownership 允许由后续专项 ADR 逐项解析，而不改变本 ADR 的 decomposition principle。

状态：**Accepted**。

本 ADR 只决定 decomposition principle，不决定：

- Modular Monolith 或 Microservices；
- process、service 或 database boundary；
- Memory authoritative ownership；
- Recommendation/Taste 的具体 architecture（后续由 ADR-008 提出）；
- Search/Retrieval architecture；
- Playback provider、session 或 recovery model；
- exact final bounded-context count；
- Collection 或 Journey 是否 standalone；
- Community/Messaging 是一个 Social BC 的 modules 还是两个 BCs。

## Why

Yara 的核心复杂度来自跨入口复用 canonical music、contextual AI、personal history 与 social experience。Capability-aligned boundaries 能保持 single ownership，同时不把尚未确认的 MVP scale 转化为 Microservices 决策。

## Trade-offs

- 接受更严格的 contract/dependency governance；
- 接受 cross-domain view 需要 query composition 或 projection；
- 换取 product semantics 稳定、deployment flexibility 与渐进演进能力。

## Consequences

- Navigation/Page ID 只能组织 client experience，不能决定 domain ownership；
- Domain Areas 仅是 conceptual grouping，不是 parent bounded context、service、database、deployment unit 或 ownership inheritance；Domain Area membership 不自动建立 bounded context；
- 一个 domain 可由同一 runtime/database 中的隔离 module 实现；本 ADR 不选择该 topology；
- 其他 domain 不得直接写 authoritative store；
- Application Layer 负责 use-case sequencing/orchestration；该技术责任不转移 bounded-context ownership；
- Yara / AI COMPANION 是 primary business area，不是 giant bounded context；YARA Interaction 不自动拥有 Taste、Personalization、Recommendation 或 Memory；Application Layer 仍负责 cross-domain orchestration；
- Shared Platform Capabilities 与 AI Runtime Capabilities 即使存储或处理数据，也不拥有 authoritative business truth；
- ADR-003 可在 logical boundaries 之上比较 topology，但在 OQ-002 与 scale/SLO/team inputs 充分前保持 Planned / Conditional；
- exact physical context/deployment count、Collection standalone、Journey standalone、Messaging standalone、Playback/Search ownership 仍 deferred；ADR-008/010 已确定 Taste/Personalization 与 Memory logical ownership；ADR-009 已确定 Knowledge ownership，并将 Music Graph 定位为保留 Catalog/Physical/Knowledge source authority 的 MUSIC-area cross-authority logical view/projection；所有 physical materialization 仍 deferred；
- MUSIC、PERSON、YARA Interaction 与 Cross-domain Personal Intelligence 的 decomposition 需要后续 lifecycle、SLO、privacy、scale 与 team evidence；
- candidate capability boundaries 可由后续专章/ADR 升格、合并或重新归属。

## Revisit Conditions

- Playback、Recommendation、Memory 或 Search 出现独立 invariant/lifecycle/scale，足以形成新的 bounded context；
- MVP scope、SLO、team ownership 或 regulatory isolation 要求改变边界；
- cross-domain coupling 指标显示当前 context 过粗或过细；
- provider ownership 模型改变 Catalog/Live/Physical responsibility。
