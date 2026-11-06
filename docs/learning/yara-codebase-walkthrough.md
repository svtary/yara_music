# Yara Codebase Walkthrough

> 定位：这是当前仓库的学习地图，解释 **How this codebase actually works**。它不是新的 Architecture Specification；发生冲突时，`docs/technical/Yara-Technical-Design.md`、Accepted ADR 与冻结产品文档仍具有更高优先级。
>
> 当前代码状态：Stage 0 与 Stage 1 已实现；Catalog 使用 Artist/Album/Recording semantics，MusicBrainz/Cover Art Archive ingestion、PostgreSQL Search projection、Catalog Detail API，以及响应式 Explore/Search + Detail Web vertical slice 已落地。

## 1. 先看全局：运行中的系统与代码中的边界

当前可以运行的主链路是：

```text
Browser
   ↓ HTTP :3000
Next.js Web / BFF
   ↓ HTTP（Web server 发出）
NestJS API on Fastify :4000
   ↓
PostgreSQL Adapter（Kysely + pg Pool）
   ↓
PostgreSQL + pg_trgm + pgvector :5432

Worker :4001
   ↓
PostgreSQL Adapter
   ↓
PostgreSQL
```

未来业务请求的目标分层是：

```text
Delivery（Web / Controller / Worker trigger）
   ↓
Application（Use Case、编排、Port）
   ↓
Domain（业务语义与 invariant）
   ↑
Adapter（实现 Port；PostgreSQL、外部 Provider 等）
```

箭头表达“谁调用谁”，依赖方向则始终向内：外层可以依赖内层，Domain 不反向认识 NestJS、Next.js、Kysely 或 PostgreSQL。

### 1.1 `apps` 与 `packages`

- `apps/*` 是 deployable：各自有 entry point，可成为独立进程或容器。
- `packages/*` 是 library/boundary：被 app 或其他 package 引用，本身通常不监听端口。
- `apps/web`、`apps/api`、`apps/worker` 可以分别启动、停止、扩容和部署。
- `packages/domain-catalog` 不会独立“运行”；它把类型、构造函数和 invariant 编译成 library。

这类似前端 monorepo 中“应用项目”和“共享包”的区别，但这里共享包还承担架构边界。

### 1.2 Domain、Application、Port、Adapter

- **Domain**：回答“什么是合法的 Catalog 对象/映射”。例如 Provider 的 `release-group` identity 可以映射到 AlbumRef，但不能因 external type 相同或相近就自动取得 canonical authority。
- **Application**：回答“一个用户意图需要按什么顺序调用哪些 Domain 能力”。当前已有 Catalog ingestion、Search 与 Detail query use cases 及其 typed ports。
- **Port**：内层声明自己需要什么能力的 TypeScript interface。例如 `CatalogQueryPort` 只描述按 canonical ID 查询和解析 provider identity。
- **Adapter**：外层对 Port 的技术实现。当前 PostgreSQL Catalog/Search adapters 使用 Kysely 实现 Application ports，MusicBrainz adapter 负责 Provider ACL 与 normalization。

这就是 Dependency Inversion：Application 依赖自己需要的 interface，而不是直接依赖 Kysely。它类似前端把 `Storage` interface 注入业务服务，而不是在业务规则中直接调用 `localStorage`，但边界更严格。

### 1.3 API host 不等于业务逻辑

NestJS 提供启动、路由、DI、生命周期和 OpenAPI 集成；Fastify 是实际处理 HTTP 的 adapter。它们是 delivery host，不是 Catalog 语义的 owner。Controller 应把输入转换为 Application command/query，再把结果转换为 API contract。若所有代码都放进 Controller/Service，Domain 会被 HTTP、框架和数据库细节绑死，Worker 也难以复用同一业务路径。

Web 不直接操作 PostgreSQL，因为浏览器不能安全持有数据库凭据，也不能承担最终 AuthZ、事务或 Domain invariant；Next.js BFF 也只能组合视图和代理 transport，不能成为 canonical mutation owner。

## 2. 当前仓库地图

```text
.
├── apps/
│   ├── web/                  # Next.js App Router Web/BFF
│   ├── api/                  # NestJS + Fastify HTTP API
│   ├── worker/               # 独立后台进程（当前仅 health skeleton）
│   └── catalog-cli/          # 受控 Provider ingestion / projection rebuild entry point
├── packages/
│   ├── contracts/            # Health + Catalog 跨 transport contract / OpenAPI
│   ├── config/               # Zod typed environment config
│   ├── application/          # Catalog ingestion / Search / Detail use cases 与 ports
│   ├── adapters-postgres/    # Kysely/pg、迁移与 PostgreSQL probe
│   ├── adapters-musicbrainz/ # Provider HTTP/DTO/normalization ACL
│   ├── ai-runtime/           # 非权威 AI execution boundary skeleton
│   ├── domain-catalog/       # 当前真实实现的 Catalog Domain
│   ├── domain-identity/      # 仅 owner boundary skeleton
│   ├── domain-knowledge/     # 仅 owner boundary skeleton
│   ├── domain-collection/    # 仅 owner boundary skeleton
│   ├── domain-memory/        # 仅 owner boundary skeleton
│   ├── domain-personalization/ # 仅 owner boundary skeleton
│   └── domain-yara-interaction/ # 仅 owner boundary skeleton
├── scripts/
│   ├── check-architecture.mjs
│   └── check-context.mjs
├── docker/Dockerfile         # 多阶段构建各 deployable
├── compose.yaml              # 本地 5-service 编排
├── .github/workflows/ci.yml  # CI quality gates + smoke tests
├── docs/                     # 产品、技术、ADR、设计、项目状态、学习资料
├── AGENTS.md                 # coding agent 长期工程约束
├── PLANS.md                  # 交付状态，不是 architecture
└── package.json              # workspace 顶层 scripts/toolchain
```

### 2.1 Runtime Apps

| App                | 进程与启动者                                                | 主要依赖                                                | 当前能做什么                                                | 不能做什么                                                       |
| ------------------ | ----------------------------------------------------------- | ------------------------------------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------- |
| `apps/web`         | `next dev` 或 standalone Node server；本机/pnpm/Docker 启动 | Next.js、React、AntD、TanStack Query、config、contracts | Explore/Search、Catalog Detail；通过 Route Handler 代理 API | 不直连 DB；不拥有 Domain mutation/final AuthZ                    |
| `apps/api`         | Node 进程；Nest bootstrap，Fastify 处理 HTTP                | NestJS、Fastify、Swagger、Application、Postgres adapter | health、Search、Catalog Detail、OpenAPI                     | 不调用 MusicBrainz；Controller 不是 Domain/Search authority      |
| `apps/worker`      | 独立 Node HTTP 进程                                         | config、contracts、Postgres adapter                     | live/ready health                                           | 尚无 pg-boss/job；不能绕过 Application/owner boundary 写任意数据 |
| `apps/catalog-cli` | 短生命周期 Node CLI                                         | Application、Provider/Postgres adapters、typed config   | 按 Provider ID 导入；显式 rebuild Search                    | 不是公开 HTTP ingestion endpoint；不提供产品 Search              |

### 2.2 Core Packages

| Package                | 当前职责                                                                     | 状态                               |
| ---------------------- | ---------------------------------------------------------------------------- | ---------------------------------- |
| `contracts`            | Health 与 Catalog HTTP transport types、service vocabulary、OpenAPI artifact | Stage 1 contracts 已实现           |
| `config`               | 将无类型 `process.env` 校验、转换成 Web/API/Worker/Provider typed config     | 已实现                             |
| `application`          | Catalog ingestion 编排、Search/Detail queries 与最小 typed ports             | 已实现                             |
| `domain-catalog`       | canonical Artist/Album/Recording、typed identity、ProviderMapping invariants | Stage 1 foundation 已实现          |
| 其他 `domain-*`        | 预留 owner/package 边界                                                      | capability 未实现                  |
| `adapters-postgres`    | Catalog query/write、Search projection/query、Detail read、迁移与 fixtures   | Tasks 1.3–1.4 已实现               |
| `adapters-musicbrainz` | MusicBrainz/CAA client、DTO 与 ACL normalization                             | Task 1.3.5 已实现                  |
| `ai-runtime`           | 非权威 AI execution 边界                                                     | skeleton；没有 Agent/LLM/RAG/Tools |

### 2.3 Engineering / Infrastructure

- `compose.yaml`、`docker/Dockerfile`：本地/容器运行拓扑。
- `.github/workflows/ci.yml`：远端 runner 上复现安装、DB migration、`verify` 与 smoke test。
- `scripts/*`：Context 完整性与依赖方向检查。
- ESLint/Prettier/TypeScript/Vitest：静态规则、格式、类型和测试。
- `pnpm-workspace.yaml`/lockfile：workspace 发现、依赖解析与可复现安装。
- `packages/contracts/openapi/yara.openapi.json`：API 生成的 machine-readable contract snapshot。

### 2.4 Governance / Context

- `AGENTS.md`：任何 coding agent 必须遵守的长期规则。
- `PLANS.md`：Stage/Task/verification 进度，不定义 architecture。
- `docs/project/CURRENT_TASK.md`（根路径是 symlink）：当前任务短指针。
- `docs/technical/Yara-Technical-Design.md` + Accepted ADR：canonical architecture。
- `docs/product/*`：冻结产品语义。
- `docs/INDEX.md`：阅读路由，不覆盖源文档。

## 3. Root 文件逐个读

| 文件                    | 做什么 / 谁读取                                              | 删除会怎样                                                           | 什么时候看                              |
| ----------------------- | ------------------------------------------------------------ | -------------------------------------------------------------------- | --------------------------------------- |
| `package.json`          | pnpm/Node 读取；定义顶层 scripts、engine、devDependencies    | 顶层命令和工具依赖失效                                               | 找 `pnpm verify/build/dev` 实际执行链时 |
| `pnpm-workspace.yaml`   | pnpm 发现 `apps/*`、`packages/*`，并集中 `catalog:` 版本     | workspace link/catalog 依赖解析失败                                  | 新增 package 或统一依赖版本时           |
| `pnpm-lock.yaml`        | pnpm 锁定精确 transitive dependency                          | 下次安装可能得到不同依赖；CI `--frozen-lockfile` 会因缺失/不同步失败 | 依赖升级时看 diff；通常不逐行读         |
| `tsconfig.base.json`    | 所有 TS 项目继承的严格编译规则                               | 每包配置失去共同基线                                                 | 类型行为或 module resolution 异常时     |
| `tsconfig.package.json` | library package 继承；开启 composite/declaration             | package build/reference 输出可能失败                                 | 新 package 或 library 编译问题时        |
| `eslint.config.mjs`     | ESLint flat config；检查 TS/React Hooks                      | `lint` 无统一规则                                                    | lint 报错或调整代码规范时               |
| `prettier.config.mjs`   | Prettier 读取格式偏好                                        | 本地/CI 格式不一致                                                   | 格式差异时；不要用于架构规则            |
| `vitest.config.ts`      | Vitest 发现 app/package tests，使用 Node environment         | 测试发现/环境改变                                                    | 测试未被执行或需要 browser env 时       |
| `.node-version`         | 部分 version manager/工具读取 Node 24                        | 本机可能选错 Node                                                    | 新机器初始化、版本异常时                |
| `.nvmrc`                | nvm 读取 Node 24                                             | `nvm use` 不能自动选版本                                             | 新 terminal/setup 时                    |
| `.env.example`          | 人和部署脚本参考所需变量                                     | 配置契约变得不可见                                                   | 创建 `.env`、新增配置时；它不含 secret  |
| `compose.yaml`          | Docker Compose 读取 services/network/volume/build/env/health | `docker compose up` 失效                                             | 本地全栈、端口/依赖/health 问题时       |
| `.dockerignore`         | Docker build context 过滤                                    | build 变慢、上下文膨胀，甚至带入不应进入 image 的文件                | image 里缺/多文件时                     |
| `.gitignore`            | Git 排除依赖、build、env、logs                               | 容易误提交生成物和 secret                                            | 新增生成目录/本地文件时                 |

## 4. `apps/web`：从 Server Component 到 health 卡片

### 4.1 App Router 与 component 边界

- `apps/web/app/layout.tsx`：默认 Server Component；声明 metadata，加载全局 CSS，包裹 `WebProviders`。
- `apps/web/app/page.tsx`：Server Component；在 server 读取 `readWebConfig(process.env)`，把安全的展示值传给页面 shell。
- `apps/web/providers/web-providers.tsx`：Server-compatible wrapper；`AntdRegistry` 收集 AntD SSR 样式，再进入 client providers。
- `apps/web/providers/client-providers.tsx`：显式 `'use client'`；通过 `useState` 创建稳定 `QueryClient`，再包 `QueryClientProvider` 与 AntD `ConfigProvider`。
- `development-shell.tsx`、`service-status-card.tsx`、`async-state.tsx`：Client Components，因为会使用 AntD 的交互运行时、React Query hooks 或 client-side state/render transitions。

Server Component 在服务端执行，不把其 JS 自动发送给浏览器，适合读取 server-only config 和组织静态结构。使用 hooks、浏览器事件或依赖 client context 的 component 必须进入 `'use client'` boundary。Provider 通常需要 client boundary，是因为 Context 与 QueryClient 要跨浏览器 render 持续存在。

### 4.2 Ant Design

1. `AntdRegistry` 解决 App Router SSR 时收集并注入 CSS-in-JS 样式，降低首屏无样式/样式顺序问题。
2. `ConfigProvider` 在 client tree 中提供 `yaraAntdTheme`。
3. `theme/tokens.ts` 保存 Yara 视觉 primitive；`theme/antd-theme.ts` 把它们映射到 AntD global/component tokens；`tokens.css` 提供 CSS variables。
4. `tokens.test.ts` 固定关键颜色、字体与圆角 anchor。

AntD 不能进入 Domain：它只负责 presentation；若 Domain import AntD，纯业务模型就无法被 Worker、测试或其他 UI 独立复用。

### 4.3 TanStack Query health 链路

```text
ServiceStatusCard
  → useQuery(['health', probe])
  → fetchHealth(probe)
  → GET /api/health/{probe}（Next Route Handler）
  → API_INTERNAL_BASE_URL/health/{probe}
  → Nest HealthController
```

- `apps/web/lib/health.ts` 只面向 Web 自己的相对 API URL。
- `apps/web/app/api/health/[probe]/route.ts` allowlist `live|ready`，在 Next server 上读取内部 API 地址并代理。
- 浏览器因此不需要知道 Docker 内部 hostname `api`。

当前没有 Zustand，因为还没有需要跨多个 client component 共享、且不属于 server state 的复杂 ephemeral state。Health 是 server state，React Query 已经负责 fetch/cache/loading/error；此时加入 Zustand 只会制造第二份状态源。

## 5. `apps/api`：NestJS、Fastify 与 DI

### 5.1 Bootstrap

1. `src/main.ts` 调用 `readApiConfig(process.env)`。
2. `createApplication(config)` 在 `src/application.ts` 中用 `NestFactory.create` 创建 Nest app，并传入 `FastifyAdapter`。
3. `AppModule.register(config)` 在 `src/app.module.ts` 建立 DynamicModule。
4. Module 用 symbol token 注入 Kysely `DATABASE`，组合 `SearchCatalogQuery`、`CatalogDetailQuery` 与 PostgreSQL adapters，并注册 health/Search/Catalog controllers 和 DB lifecycle cleanup。
5. Swagger 在 `/docs` 暴露 UI，在 `/docs/openapi.json` 暴露 JSON。
6. `main.ts` 最后 `listen(config.port, config.host)`。

### 5.2 概念对照

- **Module**：组合一组 controller/provider/config，定义 Nest container 的装配边界。
- **Controller**：HTTP transport adapter；解析路由/状态码，把请求交给服务/use case。
- **Provider**：由 Nest DI container 创建和注入的对象或值。
- **DI**：Consumer 声明依赖 token，由 composition root 决定注入哪个实例。
- **Fastify**：Nest 下面实际接收 socket/HTTP 的 platform adapter；Nest 提供更高层的 module/DI/decorator 模型。

`Controller != Business Logic`：Health Controller 把 degraded readiness 映射成 HTTP 503；Search/Catalog Controllers 只校验 transport input、调用 Application query，并映射 400/404。SQL、ranking、canonical identity 与 Provider access 均不在 Controller。

### 5.3 Liveness、readiness 与 OpenAPI

- `HealthService.live()` 只证明 API 进程可以处理请求，不访问 DB。
- `HealthService.ready()` 调用 `probePostgres()`；DB 不可达或 extension 缺失即 degraded。
- `generate-openapi.ts` 启动同一 Nest module（但不 listen），用 Swagger metadata 生成 JSON 后关闭 app。

## 6. `apps/worker`

Worker 是独立 deployable，适合耗时、异步、可重试、无需占用 HTTP request 的工作。当前它没有 NestJS，也没有 pg-boss：`src/main.ts` 只创建一个 Node HTTP server，提供 `/health/live`、`/health/ready`，并用最多 2 个连接的 Kysely pool probe DB。

未来 `embedding/index rebuild job` 可能由 pg-boss 领取任务，读取 owner 授权的数据，计算 projection，再通过相应 Application/owner-authorized path 提交结果。**该 job 当前未实现。** 即使是 Worker，也不能直接修改任意 Domain 数据；进程位置不会改变 ownership。

把所有 cron 写在 API 中会耦合 Web traffic 与 background workload：API restart/scale-out 可能重复执行，长任务抢占请求资源，任务生命周期也难以独立观测与恢复。

## 7. `packages/config`

`process.env` 的值始终是 `string | undefined`，可能缺失、拼错、格式错误。`packages/config/src/index.ts` 用 Zod：

- 校验 `NODE_ENV`、log level 的 enum；
- 把 port string 转成 1–65535 的整数；
- 要求 DB URL 是 `postgresql://`；
- 提供安全 default；
- 输出 `ApiConfig`、`WorkerConfig`、`WebConfig`。
- 输出 server-only `CatalogProviderConfig`，限制 MusicBrainz interval 不低于 1 秒，并配置 timeout/retry/base URL/User-Agent；这些变量不使用 `NEXT_PUBLIC_*`。

Web 有两个地址：

- `NEXT_PUBLIC_API_BASE_URL` 名字带 `NEXT_PUBLIC_`，可以被 Next 暴露给 browser bundle，所以绝不能放 secret。
- `API_INTERNAL_BASE_URL` 只由 Next server Route Handler 使用；Compose 中是 `http://api:4000`。

数据库凭据只进入 API/Worker server environment。任何 secret 一旦进入 `NEXT_PUBLIC_*`，就应视为公开。

## 8. `packages/contracts`

当前手写 contract 包含 `HealthResponse`；Search/Detail HTTP schema 由明确 DTO + OpenAPI 生成。Contract 面向跨进程/跨边界的消费者，不必等于 Domain type：

- Domain type 为 invariant 和 ownership 服务；
- API contract 为兼容性、序列化、版本化和外部消费服务；
- DB row 为持久化结构服务。

三者演进原因不同，因此不能直接把 row 返回浏览器，也不应默认把 Domain object 当长期 public API。`yara.openapi.json` 是从 Nest API metadata 生成的另一个 machine-readable contract；当前 frontend 尚未从它 codegen，未来可以在明确采用后生成 client/types，但本轮没有实现。

## 9. `packages/application`：Catalog ports 与 use cases

基础 canonical read boundary 仍是：

```ts
interface CatalogQueryPort {
  getArtistById(id: ArtistId): Promise<Artist | null>;
  getAlbumById(id: AlbumId): Promise<Album | null>;
  getRecordingById(id: RecordingId): Promise<Recording | null>;
  resolveProviderIdentity(identity: ProviderIdentity): Promise<ProviderMapping | null>;
}
```

Application 可以依赖 `domain-catalog`，因为它编排 Domain vocabulary；它不能依赖 Kysely。当前还定义了最小 `ExternalCatalogProviderPort`、`CatalogWritePort`、`CatalogSearchQueryPort`、`CatalogSearchProjectionPort` 与 `CatalogDetailQueryPort`。

`CatalogIngestionService` 先取 normalized provider candidate，再解析 mapping、调用 Catalog write port，最后重建 projection。`SearchCatalogQuery` 负责 trim/长度/limit/kind 校验；`CatalogDetailQuery` 委托 typed read port。具体 HTTP、MusicBrainz 与 SQL 实现都在外层。

## 10. Domain packages：边界存在不等于 capability 完成

多个 domain package 对应不同 authority/owner：Identity、Catalog、Knowledge、Collection、Memory、Personalization、Yara Interaction。拆分不是按页面，而是按语义和写入权威。

当前：

- `domain-catalog` 有真实模型、factory、invariant 和 tests。
- 其余 package 的 `index.ts` 只 `export {}` 并说明未来 Stage；它们只是预先建立 framework-free package boundary。
- `domain-yara-interaction` 是冻结技术设计中的 Yara Interaction owner 名称，不应随意缩成一个含糊的 `domain-yara`。

### 10.1 `domain-catalog` 文件

- `catalog-error.ts`：stable invariant error codes；调用方可区分非法 ID、文本、重复 ref、mapping state/type/version。
- `catalog-identity.ts`：branded IDs、closed discriminated refs、ProviderIdentity、runtime parsers/assertions。
- `catalog-model.ts`：`Artist`、Catalog-owned `Album`、`Recording` 及 immutable factories；明确排除 Physical 的 Release/Edition/Pressing/offer/inventory/market。
- `provider-mapping.ts`：external identity 到 canonical ref 的 typed mapping state machine/projection。
- `index.ts`：package public exports；外部应从 `@yara/domain-catalog` 导入，而不是穿透内部文件。

## 11. Catalog Identity：为什么不能都是 `string`

### 11.1 Compile-time

`ArtistId`、`AlbumId`、`RecordingId` 都是 `string` 与不同 `unique symbol` brand 的交叉类型。TypeScript 因此会阻止把 `AlbumId` 传给要求 `ArtistId` 的函数。`ArtistRef | AlbumRef | RecordingRef` 再用 `kind` 形成 closed discriminated union，使 object type 与 ID 类型一起传递。

如果只有 `type Id = string`，以下错误全部能编译：

- 用 Spotify/MusicBrainz external ID 查询 Yara Artist；
- 把 Album ID 放入 Artist relation；
- 将 Recording mapping 错写为 Album mapping。

### 11.2 Runtime

TypeScript 类型在运行时会被擦除，HTTP/DB/provider 输入仍可能是任意字符串。因此 `artistId()`、`albumId()`、`recordingId()` 和 `assertCatalogEntityRef()` 会拒绝空值、超长值、空白/control character 或非法 kind。

Compile-time 防止“可信 TS 代码内部混用”；runtime validation 防止“不可信边界输入伪装成正确类型”。两者不能相互替代。当前尚未选择 UUID/ULID 策略，所以只验证 opaque identity 的最低安全形态。

## 12. ProviderMapping：外部 ID 不是 Yara ID

```text
MusicBrainz observation
   ↓ createProviderIdentity
ProviderIdentity { provider, externalObjectType, externalId }
   ↓ createProviderMapping + invariant
ProviderMapping { canonicalKind, ... }
   ↓
Yara ArtistRef / AlbumRef / RecordingRef
```

以 Radiohead、_OK Computer_、“Paranoid Android”为例：

| 状态                 | 含义                                                   | 音乐领域例子                                                                |
| -------------------- | ------------------------------------------------------ | --------------------------------------------------------------------------- |
| `resolved`           | external object 唯一解析到 canonical ref               | MusicBrainz Radiohead artist ID → Yara `ArtistRef(Radiohead)`               |
| `unresolved`         | 见到 external identity，但没有可靠 canonical match     | 新导入的 “Radiohead Tribute” external artist 尚未解析                       |
| `ambiguous`          | 至少两个候选，不能安全选一个                           | provider 的 “OK Computer” release-group 无法确定对应哪个 canonical Album    |
| `superseded`         | 旧 mapping 仍可审计，但已被新版本取代                  | MusicBrainz 修正 external record 后，旧 Radiohead mapping 被新 mapping 替代 |
| `merged`             | 多个历史 external objects 收敛到一个 canonical object  | 重复 Radiohead artist records 被合并到同一 Yara ArtistRef                   |
| `split`              | 一个旧 external object 实际覆盖多个 canonical objects  | provider 旧条目混合了两个 canonical Album，需要至少两个候选                 |
| `correction_pending` | 当前 canonicalRef 仍可见，但已有至少一个待核对替代候选 | “Paranoid Android” 当前映射到 Recording A，审核发现 Recording B 可能才正确  |

重要字段：

- `externalObjectType`：Provider 自己的 taxonomy，例如 `release-group` 或 `track`。
- `canonicalKind`：Yara Catalog target kind：`artist | album | recording`；canonical/candidate refs 必须与它一致，但不要求它等于 external type。
- `provenance.sourceRef`：这次 mapping 判断来自哪个可追踪来源/批次/证据引用。
- `mappingVersion`：正安全整数，为演进与审计提供逻辑版本。
- `candidateRefs`：ambiguous/split 至少 2 个且唯一；correction_pending 至少 1 个替代候选。
- factory 会 freeze 结果，防止创建后绕开 invariant 直接 mutate。

若只用 `Map<string,string>`：provider namespace 会碰撞，Artist/Album/Recording 会混用，Provider taxonomy 也会被误当作 Yara taxonomy；同时无法表达 unresolved/ambiguity/split、provenance/version，最终 Search/AI 可能把错误 identity 当成 canonical truth。

## 13. PostgreSQL Adapter、Kysely 与 migration

`packages/adapters-postgres/src/index.ts`：

- `createPostgresDatabase()` 创建 `pg.Pool`（默认最多 10 connections）和 Kysely instance。
- Kysely 是 type-safe SQL/query builder，不是 Domain model；`YaraDatabase` 目前只声明 Catalog-owned tables，row types 保持在 adapter 内部。
- `migrateYaraDatabase()` 依次执行 extension、Catalog foundation/metadata 与 `0004_catalog_search_projection`；Search schema 是可重建 projection，不是 Catalog truth。
- `probePostgres()` 查询 PostgreSQL server version 与已安装 extension。
- `migrate.ts` 是可执行 migration entry，读取 config、迁移、打印结果、destroy pool。

Catalog adapter 分工：

- `PostgresCatalogWriteAdapter` 在事务和 provider-identity advisory lock 内接受 normalized observation、生成 opaque Yara ID、维护 mapping 和 ordered relations；重复 ingest 复用 canonical ref。
- `PostgresCatalogSearchAdapter` 从 canonical Catalog 全量、确定性重建 `search.catalog_documents`，使用 exact/prefix、FTS、`pg_trgm` 和稳定 tie-breakers 查询。
- `PostgresCatalogDetailAdapter` 组装 Artist/Album/Recording read model；不把 DB row 暴露给 API。
- `PostgresCatalogQueryAdapter` 继续负责 Domain entity/mapping round-trip，并经 Domain factory 复验。

`packages/adapters-musicbrainz` 与 Catalog 写入解耦：Provider HTTP client 负责 User-Agent、timeout、1 req/s 默认 pacing 与 bounded retry；DTO schema fail closed；normalizer 只输出批准字段。release-group 先取得 releases，再用确定性 representative release 获取 tracklist，但 Physical release 本身不会进入 Catalog。

依赖图更准确地画成：

```text
Domain vocabulary
       ↑ imported by
Application Port
       ↑ implemented by
PostgreSQL Catalog Adapter
       ↓ uses
Kysely
       ↓ uses
pg connection pool
       ↓
PostgreSQL
```

Kysely type 不能进入 Domain：table/column/nullability 是 persistence concern；一旦 Domain 接受 Kysely row 或 query builder，它的业务语义会被数据库 schema 和 library 生命周期控制，也违反 dependency direction。

## 14. Docker、Compose 与 `localhost:3000`

### 14.1 术语

- **image**：只读运行模板；例如 `pgvector/pgvector:0.8.7-pg18-bookworm`。
- **container**：image 的一个运行实例。
- **Dockerfile**：构建 Yara image 的步骤；当前是 multi-stage，复用安装/build layer，为 API/Worker/Web/Migrate 产出不同 target。
- **Compose service**：一个声明式运行单元；当前是 `postgres`、`migrate`、`api`、`worker`、`web`。
- **network**：Compose 默认创建内部网络，service name 可作为 DNS hostname。
- **volume**：`yara-postgres` 把 DB data 放到 container 生命周期之外。
- **port mapping**：如 `3000:3000` 是 host port → container port。

### 14.2 当前通信

```text
Host browser ── localhost:3000 ──> web container:3000
Host tools   ── localhost:4000 ──> api container:4000
Host tools   ── localhost:4001 ──> worker container:4001
Host tools   ── localhost:5432 ──> postgres container:5432

web container ── http://api:4000 ──> api container
api/worker/migrate ── postgres:5432 ──> postgres container
```

浏览器运行在宿主机，所以它的 `localhost` 是 Mac；container 的 `localhost` 只表示该 container 自己。因此 container 之间用 Compose DNS service name `api`、`postgres`。

打开 `http://localhost:3000` 时，OS 把 TCP 连接交给 Docker 的 host port mapping，Docker 转发到 web container 的 3000；Next server 返回 HTML/JS，浏览器随后按页面逻辑发请求。

## 15. 真实 health request 全链路

| #   | 文件 / symbol                                                       | 输入                         | 输出                                                 |
| --- | ------------------------------------------------------------------- | ---------------------------- | ---------------------------------------------------- |
| 1   | Browser                                                             | `GET http://localhost:3000/` | 请求 Next page                                       |
| 2   | `apps/web/app/page.tsx` / `HomePage`                                | server env                   | `DevelopmentShell` props/React tree                  |
| 3   | `app/layout.tsx` → `WebProviders` → `ClientProviders`               | children                     | SSR styles、QueryClient、AntD theme contexts         |
| 4   | `components/layout/development-shell.tsx`                           | env label                    | 三个 status cards                                    |
| 5   | `components/ui/service-status-card.tsx` / `ServiceStatusCard`       | `probe='live'                | 'ready'`                                             | `useQuery` loading/error/data UI |
| 6   | `apps/web/lib/health.ts` / `fetchHealth`                            | probe                        | `Promise<HealthResponse>`；请求相对 URL              |
| 7   | `app/api/health/[probe]/route.ts` / `GET`                           | Next route params            | allowlist 后代理到 internal API；失败则 503 degraded |
| 8   | `apps/api/src/health.controller.ts` / `HealthController.live/ready` | HTTP request                 | 200 live；ready 为 ok 时 200、degraded 时 503        |
| 9   | `apps/api/src/health.service.ts` / `HealthService`                  | injected Kysely DB           | typed `HealthResponse`                               |
| 10  | `packages/adapters-postgres/src/index.ts` / `probePostgres`         | `Kysely<YaraDatabase>`       | version、pg_trgm/vector booleans                     |
| 11  | PostgreSQL                                                          | two SQL queries              | result rows                                          |
| 12  | reverse path                                                        | JSON response                | React Query cache 更新，card re-render               |

Liveness 与 readiness 不同：

- DB 挂了但 Node event loop/HTTP 仍正常：`live = ok`，说明不要因依赖故障反复重启健康进程。
- DB 挂了：`ready = degraded/503`，说明流量不应再路由给这个实例，因为它不能完整服务。

## 16. 测试与不同层的防线

### 16.1 Unit / config tests

- `packages/config/src/index.test.ts`：default 与非法关键环境值。
- `apps/api/src/health.controller.test.ts`：liveness 不冒充 readiness；DB probe 失败映射为 503。
- `apps/web/theme/tokens.test.ts`：设计 token anchor。
- `musicbrainz-adapter.test.ts`：Provider DTO/normalization、pacing、timeout、404、503、malformed schema 与 CAA degradation。
- `catalog-search.test.ts`、API controller tests：Application input gate 与 HTTP 400/404 mapping。

### 16.2 Domain invariant tests

- `catalog-identity.test.ts`：nominal type、结构化 provider identity、runtime malformed input。
- `catalog-model.test.ts`：immutable Artist/Album/Recording、display metadata、文本与 duplicate refs。
- `provider-mapping.test.ts`：resolved/unresolved/ambiguous、type mismatch、版本与状态 invariant。

### 16.3 Architecture/context tests

- `scripts/check-architecture.mjs`：扫描 source imports，阻止向外依赖。
- `scripts/check-context.mjs`：检查 canonical context 文件、7 个 baseline、legacy symlink。

### 16.4 各防线能抓什么

- TypeScript：可信代码中的 ID 混用、interface 不匹配、null/optional 问题。
- Unit/domain test：runtime input 与跨字段 invariant、状态语义。
- Architecture script：合法 TS 但不合法 architecture 的 import。
- Docker/runtime：DNS、端口、镜像构建、DB extension、真实连接与启动顺序；编译器无法发现。

PostgreSQL integration tests 会创建隔离数据库，验证 0002→0004/fresh migration、fixtures、provider mapping、write rollback/idempotency、projection rebuild、Search ranking 和 Detail read models。当前仍没有正式 browser E2E。

## 17. `check-architecture.mjs`

脚本递归扫描 `apps`、`packages` 的 TS/JS source（排除 `dist`、`node_modules`、`.next`），用 import pattern 对不同路径应用规则：

- `domain-*` 禁止 Nest/Fastify/Next/React/AntD/Kysely/pg/Application/AI Runtime/Adapter。
- `application` 禁止 delivery 与 DB adapter。
- `ai-runtime` 禁止 Domain repository/adapter/delivery framework。
- `apps/web` 禁止直接 import Domain、adapter、AI Runtime。

它应阻止：

```ts
// 错：Domain 依赖外层 framework
import { Injectable } from '@nestjs/common';

// 错：Application 直接选择了 persistence implementation
import { createPostgresDatabase } from '@yara/adapters-postgres';
```

TypeScript 只关心“import 是否能解析、类型是否正确”，不会知道组织规定的 dependency direction。因此需要额外 architecture gate。当前脚本是轻量 regex scanner，不是完整 parser；它覆盖既定 import 形式，但不能证明全部语义正确，仍需 code review。

## 18. `pnpm verify` 到底做什么

按顶层 `package.json` 的串行顺序：

1. `format:check`：Prettier 检查；失败先看列出的文件并运行 `pnpm format`。
2. `lint`：ESLint 静态规则/React hooks；看具体 rule 与行号。
3. `check:context`：canonical docs、baseline、symlink；看 missing/broken path。
4. `check:architecture`：依赖方向；看 forbidden import 和 reason。
5. `typecheck`：所有 workspace package；从第一个 TS diagnostic 处理。
6. `test`：Vitest 当前 unit/invariant tests；看失败 case 的 expected/actual。
7. `build`：先 build packages，再 API/Worker/Web；能暴露 declaration、Next production build/standalone 问题。
8. `openapi:generate`：由已编译 API 生成 `yara.openapi.json`；生成 diff 应对应 controller/DTO 改动。

`verify` 不会替代 Compose runtime smoke test；真实 DB/Docker 仍需单独运行。

## 19. GitHub Actions CI

`.github/workflows/ci.yml` 定义一个 workflow：push 到 `main` 或 pull request 时触发。核心概念：

- **runner**：GitHub 提供的 Ubuntu VM。
- **job**：在 runner 上执行的一组 steps；当前用 PostgreSQL service container。
- **step**：checkout、安装 Node/pnpm、install、migrate、verify、smoke 等顺序动作。
- **cache**：Node/pnpm action 根据 lockfile 复用 package 下载，但不会跳过 correctness gate。

```text
local pnpm verify
   ↓ git push
GitHub runner checkout
   ↓ install --frozen-lockfile
Postgres migration
   ↓ pnpm verify
API/Web smoke
```

当前目录是 Git repository，工作分支为 `feat/musicbrainz-catalog-adapter`，并配置了 `origin`。本地存在/更新 workflow 不等于 GitHub Actions 已运行；只有 push 或 pull request 触发匹配事件后，远端 runner 才会执行并留下独立证据。

## 20. OpenAPI

OpenAPI 是 HTTP API 的 machine-readable 描述：路径、method、status、schema。Nest 的 Swagger decorators 和 application metadata 经 `generate-openapi.ts` 产生 `packages/contracts/openapi/yara.openapi.json`。

当前 artifact 包含 `/health/*`、`/search`、`/artists/{id}`、`/albums/{id}`、`/recordings/{id}`；Search response 用 discriminator 定义 Artist/Album/Recording union。Web 通过 `@yara/contracts` 的显式 transport types、运行时 response guard 与 Next BFF 消费这些 endpoints；UI 不直接读取 OpenAPI JSON，也不暴露 DB row。

生成文件不必逐行读：优先检查 endpoint/schema/status 的语义 diff，以及它是否与 source controller/DTO 改动一致。

## 21. AI Runtime Skeleton

`packages/ai-runtime/src/index.ts` 只有注释与 `export {}`。它表示“非权威 execution mechanics 应有独立边界”，不表示已经实现：

- Agent；
- LLM/Model Provider；
- RAG/Retrieval；
- typed Tool Calling；
- Structured Output；
- Recommendation 或 Memory。

未来这里会放受控 runtime、execution/session mechanics、provider-facing execution ports 等，但仍不能直接写 Memory/Taste/Knowledge/Collection 或拥有 Domain truth。具体实现必须等待对应 Stage。

## 22. 当前 Catalog Search / Detail 请求链路

```text
Browser
  ↓ GET /search
Search Controller
  ↓
SearchCatalogQuery（input gate）
  ↓
CatalogSearchQueryPort
  ↓
PostgresCatalogSearchAdapter
  ↓
search.catalog_documents（derived / rebuildable）
  ↓
canonical refs + typed SearchResult union
```

Detail 路径是 `CatalogController → CatalogDetailQuery → CatalogDetailQueryPort → PostgresCatalogDetailAdapter → catalog.*`。产品 Search 绝不访问 MusicBrainz；Provider outage 不影响已导入对象的 Search/Detail。`Search != Retrieval != Recommendation`，当前没有 vector/LLM/personalized ranking。

### 22.1 当前 Web Search / Detail 请求链路

```text
Explore input + URL ?q=
  ↓ 320 ms debounce
TanStack Query（cache / cancellation / stale protection）
  ↓ typed catalog-api client + runtime response guard
Next Route Handler BFF `/api/catalog/*`
  ↓ server-side proxy
Yara API Search / Detail
```

`apps/web/features/catalog/` 按 query、transport、result component、detail surface 和纯 utility 拆分。Search 通过 `kind` 分流，不根据 optional field 猜类型；Detail links 使用 API 返回的 canonical ID。路径 ingress decode 一次、outbound encode 一次，支持 `album:yara:<uuid>`，不从名称或 Provider ID 推导 identity。浏览器 Back 依赖标准 Next/history，并由 `/explore?q=...` 恢复 query，不创建自定义 navigation stack。

## 23. 每次 Codex 改动后的固定 Code Review 方法

1. `git diff --stat`：先看改动规模是否符合 Task。
2. `git status --short` + 目录树：识别新增/删除/生成物。
3. 找 entry point：app `main/page/route`、script 或 public factory。
4. 看 package `src/index.ts`/`exports`：外部 API 是否扩大。
5. 逐行读 Domain/contract：它们承载长期语义和 invariant。
6. 看 Application：use case、Port、授权/编排方向。
7. 看 Adapter：如何实现 Port、事务/SQL/provider failure 如何处理。
8. 看 tests：测试是否证明需求，而不只是覆盖行数。
9. 走一遍 runtime path：输入如何跨进程/层，输出如何返回。
10. 自己运行适用 verification，不把“有脚本”当“已通过”。

值得逐行读：Domain factory/invariant、Application command/query、AuthZ/idempotency、migration、external side effect、并发/事务代码。只需先理解职责：framework bootstrap、theme mapping、标准配置。通常不逐行读：`pnpm-lock.yaml`、`dist/`、`.next/`、完整 generated OpenAPI；但要检查它们的高层 diff 是否合理。

## 24. VS Code 中怎么追代码

- **Go to Definition**：F12 或 Cmd+Click；从 `CatalogQueryPort` import 跳到 interface。
- **Peek Definition**：Option+F12；不离开当前文件查看定义。
- **Find All References**：Shift+F12；查看谁使用 symbol。
- **Call Hierarchy**：右键 symbol → Show Call Hierarchy；适合 `fetchHealth`、`probePostgres`。
- **Workspace Search**：Cmd+Shift+F；找文本/import/error code。
- **Go to Symbol**：Cmd+T 搜 workspace symbol，Cmd+Shift+O 搜当前文件 symbol。
- **Integrated Terminal**：在 repo root 跑 filters/tests/rg；先确认 `pwd`。

看到 `CatalogQueryPort` 时：

1. Go to Definition 到 `packages/application/src/catalog/catalog-query-port.ts`。
2. Find All References；找到外层 `PostgresCatalogQueryAdapter` 实现与 API composition-root binding。
3. 搜索 `implements CatalogQueryPort`；确认实现位于 `adapters-postgres`，而不是 Application 或 Domain。
4. 检查 Application 没有反向 import adapter，Web 也没有直接 import Domain/数据库。

## 25. 常用终端命令：每条命令回答什么问题

```bash
# Port 定义、引用和未来实现在哪里？
rg "CatalogQueryPort"

# 谁依赖 Catalog Domain？是否符合方向？
rg "from .*domain-catalog" apps packages

# PostgreSQL adapter 在哪些 composition root 被使用？
rg "adapters-postgres" apps packages package.json pnpm-lock.yaml

# 只 typecheck Catalog package
pnpm --filter @yara/domain-catalog typecheck

# 只 build Application 及其 workspace 依赖（pnpm filter 语法可按需要调整）
pnpm --filter @yara/application... build

# 只跑 Catalog tests
pnpm exec vitest run packages/domain-catalog

# 全 workspace typecheck / 完整质量门
pnpm typecheck
pnpm verify

# Compose 状态、实时日志、某一 service 日志
docker compose ps
docker compose logs -f
docker compose logs -f api

# 直接检查 health
curl -i http://localhost:4000/health/live
curl -i http://localhost:4000/health/ready

# 本地 fixtures 与 Search projection（会重置 development Catalog fixtures）
pnpm db:seed
pnpm search:rebuild

# Provider ingestion（Album 参数是 MusicBrainz release-group ID）
DATABASE_URL=postgresql://yara:yara_local_only@localhost:5432/yara \
  pnpm catalog:ingest:musicbrainz album <musicbrainz-release-group-id>

# Search / Detail
curl 'http://localhost:4000/search?q=radiohead'
curl 'http://localhost:4000/albums/album%3Aok-computer'

# 查看 OpenAPI endpoint
curl http://localhost:4000/docs/openapi.json
```

命令应在 repository root 执行。`logs -f` 会持续跟随，按 Ctrl+C 只停止跟随，不会停止 containers。

## 26. 推荐阅读顺序

1. `AGENTS.md`、`PLANS.md`、`docs/INDEX.md`：知道规则、状态和源文档。
2. 根 `package.json`、`pnpm-workspace.yaml`：建立 monorepo/命令地图。
3. `apps/web/app/page.tsx` → providers → `ServiceStatusCard` → Route Handler。
4. `apps/api/src/main.ts` → application → module → controller → service。
5. `packages/adapters-postgres/src/index.ts` + `compose.yaml`。
6. `packages/domain-catalog/src/index.ts` → identity → model → mapping → tests。
7. `packages/application/src/catalog/catalog-query-port.ts`。
8. `apps/worker/src/main.ts`。
9. architecture/context scripts、CI、OpenAPI artifact。

读代码时持续问三件事：这是谁的语义？谁有权写？当前是实现、interface，还是 skeleton？
