# clitemplate

一个用 [Cordis](https://github.com/cordiverse/cordis) 搭的、可成长的 CLI 项目模板。

pnpm workspace monorepo：`apps/` 放产品装配，`packages/<能力域>/<包>/` 放能力。

## 成长路线

- [x] 步骤 0：workspace 骨架
- [ ] 步骤 1：第一个能跑的 bin
- [ ] 步骤 2：接入 Cordis 内核
- [ ] 步骤 3：第一条能力 seam
- [ ] 步骤 4：启动审计
- [ ] 步骤 5：宿主事实作为服务
- [ ] 步骤 6：配置 schema
- [ ] 步骤 7：日志
- [ ] 步骤 8：热重载
- [ ] 步骤 9：patch 分层
- [ ] 步骤 10：门禁脚本

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
