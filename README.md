# clitemplate

一个用 [Cordis](https://github.com/cordiverse/cordis) 搭的、**可成长**的 CLI 项目模板。

pnpm workspace monorepo：`apps/` 放产品装配，`packages/<能力域>/<包>/` 放能力。

> **📖 完整的构建过程、设计取舍、每一个踩过的坑：[docs/构建日志.md](docs/构建日志.md)**
>
> 那份文档是这个仓库最有价值的部分 —— 它记录的是**为什么这么做**，
> 而代码只能告诉你**做了什么**。

---

## 快速开始

```sh
pnpm install
pnpm ctl                    # 跑默认组合
pnpm check                  # lint + typecheck + 架构门禁 + 测试
```

## 命令

| 命令 | 干什么 |
|---|---|
| `pnpm ctl` | 跑默认组合（裸 node 直接执行 TypeScript，无需构建） |
| `pnpm ctl --dump-config` | 只打印最终会挂载的条目，不启动任何插件 |
| `pnpm ctl:watch` | 热重载模式（改源码或 `cordis.yml` 即时生效，进程不退出） |
| `pnpm check` | lint + typecheck + verify + test，一条命令跑全 |
| `pnpm verify` | 只跑架构门禁（`pnpm verify catalog` 可单跑一道） |
| `pnpm test` | vitest |
| `pnpm lint:fix` | Biome 自动修格式与 import 顺序 |

**环境开关**（只认 shell / CI 层，写进 `.env` 无效）：

```sh
CTL_CONFIG=<path>      整份换掉配置文件
CTL_PROFILE=prod       叠加 patches/prod.yml
CTL_LOG_FILE=./ctl.log 日志同时落盘（JSON Lines）
CTL_WATCH=1            热重载模式
```

> 为什么这四个不接受 `.env`：**一个提交进版本库的文件，不该有能力改变整个应用的组合。**
> 实现是 `env.getFrom(key, ['process'])` —— 省略 `'app-env'` 层是**拒绝**，不是降级。

---

## 这个模板在演示什么

**五条能力 seam。** 每一条都能「改一行配置换掉实现，消费方一个字不动」。

```
packages/
├── prompt/      system prompt 的 section 注册表    ← 槽位语义：同名【替换】
├── notify/      通知能力（控制台 / 文件）           ← 槽位语义：同名【撞车报错】
├── host/        宿主事实（env：shell / 写死）
├── logging/     日志 exporter（JSON Lines 落盘）
└── task/        定时任务（演示 effect + isolate）
```

**五种角色**（`packages/notify/` 里全都有）：

| 角色 | 包名形态 | 特征 |
|---|---|---|
| 契约 | `@ctl/notify` | 只有类型，零实现。**不是插件**（没有 `apply`） |
| 提供方 | `@ctl/notify-console` | 挂招牌。摘了就没人提供这个能力 |
| 消费方 | `@ctl/tool-notify` | `inject` 招牌。摘了功能就没了 |
| 观察方 | `@ctl/notify-audit` | 只听事件，**不 inject 任何东西** |
| 策略方 | `@ctl/notify-quiet-policy` | 一票否决。**摘了照常跑**，只是没人拦 |

**换实现的启用点只有一个** —— `apps/cli/cordis.yml`：

```yaml
- id: notify
  name: '@ctl/notify-console'     # ← 改这一行
  # name: '@ctl/notify-file'
```

试一下：

```sh
pnpm ctl                                 # 通知打到控制台
CTL_PROFILE=prod pnpm ctl                # 换成写文件（patches/prod.yml）
diff <(pnpm ctl:dump) <(CTL_PROFILE=prod pnpm ctl:dump)
```

---

## 三层防线

```
Biome           格式 + import 顺序 + lint 规则        pnpm lint
tsc             类型 + 环境边界                       pnpm typecheck
verify-*.ts     架构门禁（6 道）                       pnpm verify
vitest          测试（含门禁自己的测试）                pnpm test
```

### 架构门禁守的是什么

| 门禁 | 约束 |
|---|---|
| `package-invariants` | 包的形态与它在依赖图里的位置一致（`exports` 是库的属性，`bin` 是应用的属性） |
| `dependency-layering` | 宿主用 `dependencies`，插件用 `peerDependencies`；peer 必须配一份 dev |
| `catalog` | 外部依赖一律走 catalog 协议；**框架本体不许开具名目录** |
| `runtime-closure` | `cordis.yml` 与 `patches/` 引用的每个包，宿主都已声明 |
| `env-access` | 只有宿主能直接读 `process.env`，插件走 `ctx.env` |
| `effect-cleanup` | `apply` 不返回复原单（会被静默丢弃），清理一律走 `ctx.effect` |

**每一道都对应一次真实事故**，而且都有测试证明它抓得到 ——
`pnpm test` 里 17 个用例专门干这件事。

> **一道从不失败的门禁等于没有。** 加新门禁时必须同时加两个用例：
> 合规放行 + 违规抓到（含报错指向的文件是否正确）。

### git hook 只拦格式

```
提交前   只跑格式化（自动修 + 重新暂存），修不好才拦
CI       lint / typecheck / 门禁 / 测试 / 冒烟
```

**格式化是确定性的，不改语义，拦得起。lint 规则会误报**（本仓库就有活例子：
三家 lint 工具都把契约包里必需的 `import type {}` 报成未使用的导入）。

**拦一次误报，就会有人加 `--no-verify`；加成习惯之后整套约束全废。**

`pnpm install` 会自动把 `core.hooksPath` 指到 `.githooks/`，不用 husky。

---

## 运行方式：裸 node 直接跑 TypeScript

本模板的 TS 只用**可擦除语法**（`erasableSyntaxOnly`），
所以 Node 的 type stripping 就能直接执行，**开发期完全没有构建步骤**。

| | `pnpm ctl`（裸 node） | `pnpm ctl:tsx` |
|---|---|---|
| `enum` / 装饰器等不可擦除语法 | ❌ | ✅ |
| tsconfig 路径别名 | ❌ | ✅ |
| 启动速度 | **更快** | 略慢（要转译） |
| 需要 tsx 能从 cwd 解析 | ❌ | ✅ **是**（仓库外调用会失败） |

> **默认走裸 node 是有意的**：一旦有人用了不可擦除语法，
> 会当场报 `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX` —— 约束立刻生效，而不是等到发布时才发现。

要求 Node `^22.19.0 || >=24.0.0`（见 `engines`）。pnpm 版本由 `packageManager` 字段**强制**（corepack 会执行它）。

---

## 配置在哪里

```
apps/cli/cordis.yml         这个 app 的【基线组合】—— 声明全部候选
apps/cli/patches/*.yml      按环境叠加的差异（CTL_PROFILE=prod）
apps/cli/.env.example       默认环境值（复制成 .env 使用，.env 不进版本库）
```

启动器从**包内路径**解析配置（`import.meta.url` 相对定位），**不依赖当前工作目录** ——
所以在任何目录调用这个 CLI 都能正常工作。

### 为什么基线要声明「全部候选」

因为 **patch 改不了 `name`**（`name` 在 patch 里是**断言**，不是修改）。
所以「换实现」的正确姿势是：**基线声明全部候选（备选项 `disabled: true`），
patch 只负责开关。**

额外好处：一眼看得出这个 app 到底可能装哪些东西，
而且**没人能靠 patch 偷偷塞进一个基线里没声明过的插件**。

### 有些东西【不在】配置里

日志 sink 和 HMR 由 `apps/cli/src/boot.ts` 挂载，不进配置树。原因是**引导悖论**：

> **引导阶段需要的东西，不能来自引导过程本身的产物。**

配置树里的条目是 `Promise.allSettled` **并发** apply 的 —— 把 logger 写在
`cordis.yml` 第一行也保证不了它先跑完，启动最早期那批日志会被静默丢弃。

---

## TypeScript 约定

**语言层面**：`tsconfig.base.json` 开 `erasableSyntaxOnly`，禁 `enum` / `namespace` / 装饰器。

**环境层面**：`tsconfig.base.json` **不声明 `types`** —— 它只管「语言怎么用」，不管「跑在哪」。
需要 Node 全局的包自己写：

```json
{ "extends": "../../../tsconfig.base.json",
  "compilerOptions": { "types": ["node"] },
  "include": ["src"] }
```

**全仓库只有一份 `vitest.config.ts`** —— 测试是横切的。
而 tsconfig 每包一份，因为编译单元 = 包边界 = 发布边界。

---

## 已知陷阱

完整清单见 [docs/构建日志.md](docs/构建日志.md)，这里只列最高频的四个。

### `cordis.yml` 顶层必须是数组

全部注释掉 ≠ 空配置 —— YAML 解析出来是 `null`，报
`TypeError: config file must be a top-level array`。要「什么都不挂」就写 `[]`。

### 读 Cordis 错误的三步

1. **看动词**：`failed to import` = 模块没找到；`failed to apply` = 你的代码抛异常了
2. **看括号里的 `id`**：定位是配置文件的哪一行 —— 所以 `id` 要起有意义的名字
3. **看最底下的 `[cause]`**：真正的根因

### 明明装好了却说找不到包

```
Cannot find package '@ctl/xxx' imported from …/cordis-plugin-loader/lib/index.js
```

盯住 **`imported from`** 那半句：不是你的应用找不到，是 **loader** 找不到 ——
裸包名的解析起点是**代你去找的那个人**所在的位置。

解法是给 `apps/cli` 装 `node-addon-require-builtin`（loader 的**可选 peer**，
不装不报错，只静默降级）。这个坑**只在你开始拆包之后才会出现**。

### 契约包里那行 `import type {}` 不能删

```ts
import type {} from '@deepseek-ai/cordis'
```

**三家 lint 工具都会说它没用。别信** —— 删掉 `tsc` 立刻报
`TS2664: Invalid module name in augmentation`。它是模块增强的必需前提，
静态分析看不出这层关系。

> **代码由人控制，lint 只是提意见。**

---

## 目录

```
apps/cli/                  宿主：boot（Loader → 环境快照 → 日志 sink → 配置树 → 审计）
  src/boot.ts              启动顺序，每一步都解决一个引导期问题
  src/audit.ts             启动审计：把静默的 PENDING 变成响亮的失败
  src/profile.ts           patch 分层 + dump-config
  cordis.yml               基线组合  ← 唯一的启用点
  patches/                 按环境的差异

packages/<能力域>/<包>/    五条 seam，见上文
scripts/                   六道架构门禁 + 它们自己的测试
docs/构建日志.md            ⭐ 为什么这么做
.githooks/                 提交前只拦格式
```
