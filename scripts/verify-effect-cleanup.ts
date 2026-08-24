/**
 * 门禁：清理只写 ctx.effect，不用 apply 的返回值。
 *
 * 守的约束：`export function apply` 的返回值【被静默丢弃】。
 *
 * 原因在 cordis 的 isConstructor —— 它唯一的判据是「有没有 prototype」：
 *   export function apply(c){}   有 prototype → 被 new 出来 → 返回值丢弃 ✘
 *   { apply(c){} } 简写方法       无 prototype → 正常调用 → 收集为复原单 ✔
 *
 * 而 cordis 生态的标准写法恰恰是 `export function apply`。
 * 所以在这个仓库里，apply 的返回值永远不会成为复原单 —— 而且没有任何警告。
 */
import { readFileSync } from 'node:fs'
import { relative } from 'node:path'
import { listPackages, listSources, type Gate, type Violation } from './lib/workspace.ts'

export const gate: Gate = {
  name: 'effect-cleanup',
  guards: 'apply 不返回复原单（会被静默丢弃），清理一律走 ctx.effect',
  run(root) {
    const v: Violation[] = []
    for (const pkg of listPackages(root)) {
      for (const abs of listSources(pkg.abs)) {
        const lines = readFileSync(abs, 'utf-8').split('\n')
        let inApply = false
        let applyLine = 0
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i] ?? ''
          if (/^export\s+(async\s+)?function\s+apply\s*\(/.test(line)) {
            inApply = true
            applyLine = i + 1
            continue
          }
          if (inApply) {
            if (/^}/.test(line)) { inApply = false; continue }
            // apply 函数体顶层（两个空格缩进）的 return 一个函数
            if (/^ {2}return\s*(\(\s*\)|\w+)\s*=>/.test(line) || /^ {2}return\s+function\b/.test(line)) {
              v.push({
                file: `${relative(root, abs)}:${String(i + 1)}`,
                message: `apply（第 ${String(applyLine)} 行）返回了一个函数`,
                fix: 'cordis 会把 export function apply 当构造函数 new 出来，返回值直接丢弃。改用 ctx.effect(() => { …; return () => … })',
              })
            }
          }
        }
      }
    }
    return v
  },
}
