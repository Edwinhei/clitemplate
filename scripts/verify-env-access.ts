/**
 * 门禁：只有宿主能直接读 process.env。
 *
 * 守的约束：插件要拿环境值必须走 ctx.env 服务。
 * 直接写 process.env 会同时坏掉三样东西 ——
 *   ① 把同构包绑死在 Node 上
 *   ② 依赖藏进函数体，inject 那一行看不出来
 *   ③ 测不了（要改全局）、换不了（云端换源就得改代码）
 *
 * 白名单里的两处是【事实的源头】，不是消费者：
 * 引导期需要环境值时配置树还没加载，ctx.env 那块招牌根本不存在。
 */
import { readFileSync } from 'node:fs'
import { relative } from 'node:path'
import { listPackages, listSources, type Gate, type Violation } from './lib/workspace.ts'

/** 允许直接读 process.env 的文件（相对仓库根） */
const ALLOWED = [
  'apps/cli/src/bin.ts',                    // 引导：CTL_CONFIG / CTL_PROFILE
  'apps/cli/src/boot.ts',                   // 引导：读不到 ctx.env 的那一段
  'packages/host/env-launch/src/index.ts',  // 唯一把 process.env 包装成服务的地方
]

/**
 * 把 // 行注释和 /* *\/ 块注释的内容替换成等长空白。
 *
 * 保留换行符是关键 —— 门禁要能报出准确行号，
 * 一个报错在第 14 行还是第 41 行，排查体验差很多。
 */
function stripComments(text: string): string {
  const blank = (m: string): string => m.replace(/[^\n]/g, ' ')
  return text
    .replace(/\/\*[\s\S]*?\*\//g, blank)
    .replace(/\/\/[^\n]*/g, blank)
}

export const gate: Gate = {
  name: 'env-access',
  guards: '只有宿主能直接读 process.env，插件走 ctx.env',
  run(root) {
    const v: Violation[] = []
    for (const pkg of listPackages(root)) {
      for (const abs of listSources(pkg.abs)) {
        const file = relative(root, abs)
        if (ALLOWED.includes(file)) continue
        // 先把注释挖空再检查 —— 否则「不要写 process.env」这种说明也会被算成违规。
        // 用等长空白替换，行号才不会错位。
        const lines = stripComments(readFileSync(abs, 'utf-8')).split('\n')
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i] ?? ''
          if (/\bprocess\.env\b/.test(line)) {
            v.push({
              file: `${file}:${String(i + 1)}`,
              message: '直接读了 process.env',
              fix: '插件走 ctx.env（inject 里加 "env"）。确实属于引导期的，加进 verify-env-access.ts 的白名单并写明理由',
            })
          }
        }
      }
    }
    return v
  },
}
