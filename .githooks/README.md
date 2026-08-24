# git hooks

`pnpm install` 会自动把 `core.hooksPath` 指到这个目录（见根 `package.json` 的 `prepare`）。
不用 husky，也不用 lint-staged —— Biome 自带 `--staged`。

## 现在有什么

| hook | 干什么 | 会拦你吗 |
|---|---|---|
| `pre-commit` | 格式化暂存区文件并重新暂存；修不好才拦 | **只在格式修不好时拦** |

## 设计取舍：本地只拦确定性的东西

**格式化是确定性的** —— 只重排空白、引号、换行、import 顺序，不改语义，
不需要你做任何判断。这种检查拦得起，因为它不会冤枉你。

**lint 规则会误报。** 本仓库的真实例子：三家 lint 工具都把契约包里的

```ts
import type {} from '@deepseek-ai/cordis'
```

报成「未使用的导入」。但删掉它 `tsc` 立刻报
`TS2664: Invalid module name in augmentation` —— 那行是模块增强的必需前提，
静态分析看不出这层关系。

**拦一次误报，就会有人加 `--no-verify`；加成习惯之后整套约束全废，
而你还以为它在保护你。**

所以分工是：

```
提交前   格式          确定性、自动修、修不好才拦
CI       lint          会误报 → 让人看到但不阻断心流
         typecheck     ⭐ 唯一的类型裁判
         verify-*      架构门禁
         冒烟          默认组合能起来、各 profile 算得出来
```

CI 绕不过去，所以真正的拦截放在那里才有效。

## 想加更严的规则

需要时自己打开 —— **但先想清楚它会不会逼人 `--no-verify`**。

**禁止直接提交主干**（团队协作有用；单人直推 main 的话别开）：

```sh
branch=$(git rev-parse --abbrev-ref HEAD)
if [ "$branch" = "main" ] || [ "$branch" = "master" ]; then
  echo "❌ 禁止直接提交到 $branch，请用 feature 分支"
  exit 1
fi
```

**提交信息格式**（Conventional Commits）—— 新建 `.githooks/commit-msg`：

```sh
#!/bin/sh
msg=$(head -n1 "$1")
case "$msg" in "Merge "*|"Revert "*|"fixup!"*|"squash!"*) exit 0 ;; esac
echo "$msg" | grep -qE '^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\([a-z0-9/_-]+\))?!?: .{1,}$' && exit 0
echo "❌ 提交信息不符合 Conventional Commits：$msg"
exit 1
```

十行正则就够，不用装 commitlint 那两个依赖。
