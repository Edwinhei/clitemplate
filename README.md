# clitemplate

一个用 [Cordis](https://github.com/cordiverse/cordis) 搭的、可成长的 CLI 项目模板。

pnpm workspace monorepo：`apps/` 放产品装配，`packages/<能力域>/<包>/` 放能力。

## 成长路线

- [x] 步骤 0：workspace 骨架
- [x] 步骤 1：第一个能跑的 bin
- [x] 步骤 2：接入 Cordis 内核
- [ ] 步骤 3：第一条能力 seam
- [ ] 步骤 4：启动审计
- [ ] 步骤 5：宿主事实作为服务
- [ ] 步骤 6：配置 schema
- [ ] 步骤 7：日志
- [ ] 步骤 8：热重载
- [ ] 步骤 9：patch 分层
- [ ] 步骤 10：门禁脚本

## 运行

```sh
pnpm ctl              # 裸 node 直接跑 TypeScript —— 无需 tsx、无需构建
pnpm ctl --help
pnpm ctl:tsx          # 后备：需要路径别名或不可擦除语法时才用
```

### 为什么默认是裸 node

本模板的 TS 只用**可擦除语法**（见下文 `erasableSyntaxOnly`），
所以 Node 的 type stripping 就能直接执行它。

| | `pnpm ctl`（裸 node） | `pnpm ctl:tsx` |
|---|---|---|
| 支持 `enum` / 装饰器等不可擦除语法 | ❌ | ✅ |
| 支持 tsconfig 路径别名 | ❌ | ✅ |
| 启动速度 | **更快** | 略慢（要转译） |
| 需要 tsx 能从 cwd 解析 | ❌ | ✅ **是**（仓库外调用会失败） |

> **默认走裸 node 是有意的**：一旦有人不小心用了不可擦除语法，
> 会当场报 `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX` —— 约束立刻生效，而不是等到发布时才发现。

## 配置位于何处

`cordis.yml` 属于**具体的 app**，不在仓库根目录：

```
apps/cli/cordis.yml        这个 app 的【默认组合】，随代码走，进仓库
```

启动器从**包内路径**解析它（`import.meta.url` 相对定位），
**不依赖当前工作目录** —— 所以在任何目录调用这个 CLI 都能正常工作。

用 `CTL_CONFIG=<path>` 可以整份替换。

> **未来（步骤 9）**会引入 patch 分层：包内是基线，用户目录放覆盖，启动时叠加。
> 那时调试改用户层，`git status` 永远干净。

## TypeScript 约定

### 语言层面：只用可擦除语法

`tsconfig.base.json` 开启了 `erasableSyntaxOnly`，
**禁止 `enum`、`namespace`、装饰器** —— 用 `as const` 对象代替 `enum`。

**收益**：全仓库的 TS 可以被 Node **直接执行**，开发期不需要构建步骤。

> 如果将来某个 app 选了重度依赖装饰器的框架（如 NestJS），
> 它是唯一需要构建步骤的 app，应在自己的 `package.json` 里声明 build 脚本，
> 不影响其他包。

### 环境层面：`types` 按包声明，不写在基础配置里

`tsconfig.base.json` **不声明 `types`** —— 它只管「语言怎么用」，不管「跑在哪」。

需要 Node 全局（`process`、`Buffer`…）的包，**自己在 tsconfig 里显式写**：

```json
{ "extends": "../../tsconfig.base.json",
  "compilerOptions": { "types": ["node"] },
  "include": ["src"] }
```

## 已知陷阱

### cordis.yml 顶层必须是数组

全部注释掉 ≠ 空配置 —— YAML 解析出来是 `null`，会报
`TypeError: config file must be a top-level array`。

**要「什么都不挂」就写 `[]`：**

```yaml
# 全部停用
[]
```

### 条目 id 必须唯一

两个条目用同一个 `id` → `TypeError: duplicate loader entry id: xxx`

### 读 Cordis 错误的三步

1. **看动词**：`failed to import` = 模块没找到（路径/包名错、没装）；
   `failed to apply` = 模块找到了，你的代码抛异常了
2. **看括号里的 `id`**：定位是 `cordis.yml` 的哪一行 —— 所以 `id` 要起有意义的名字
3. **看最底下的 `[cause]`**：真正的根因

### `--import tsx` 依赖 cwd

`node --import tsx <绝对路径>` 在仓库外调用会报
`Cannot find package 'tsx' imported from <cwd>` —— tsx 是从**当前工作目录**解析的。

裸 `node <绝对路径>` 没有这个问题。
