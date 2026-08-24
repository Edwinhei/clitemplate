/**
 * 门禁总入口。
 *
 * 把所有 verify-* 跑一遍，一次性把问题全列出来 —— 而不是修一个跑一次。
 * 任意一条违规 → 退出码 1。
 *
 * 用法：
 *   pnpm verify              跑全部
 *   pnpm verify catalog      只跑某一道（名字前缀匹配）
 *
 * 这是「约定 → 工具 → 门禁」三层执行力里最后、也是唯一有牙齿的一层。
 * 前面两层（写在文档里的约定、tsc 这类工具）都拦不住「明明能跑但违反了架构」的改动。
 */
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import type { Gate } from './lib/workspace.ts'
import { gate as packageInvariants } from './verify-package-invariants.ts'
import { gate as dependencyLayering } from './verify-dependency-layering.ts'
import { gate as catalog } from './verify-catalog.ts'
import { gate as envAccess } from './verify-env-access.ts'
import { gate as runtimeClosure } from './verify-runtime-closure.ts'
import { gate as effectCleanup } from './verify-effect-cleanup.ts'

const GATES: Gate[] = [
  packageInvariants,
  dependencyLayering,
  catalog,
  runtimeClosure,
  envAccess,
  effectCleanup,
]

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const filter = process.argv[2]
const selected = filter ? GATES.filter((g) => g.name.startsWith(filter)) : GATES

if (selected.length === 0) {
  console.error(`没有匹配 "${filter}" 的门禁。可用：${GATES.map((g) => g.name).join(', ')}`)
  process.exit(1)
}

let failed = 0
for (const g of selected) {
  const violations = g.run(root)
  if (violations.length === 0) {
    console.log(`✅ ${g.name.padEnd(22)} ${g.guards}`)
    continue
  }
  failed += violations.length
  console.log(`❌ ${g.name.padEnd(22)} ${g.guards}`)
  for (const v of violations) {
    console.log(`     ${v.file}`)
    console.log(`       ${v.message}`)
    if (v.fix) console.log(`       ↳ ${v.fix}`)
  }
}

console.log()
if (failed > 0) {
  console.log(`共 ${String(failed)} 条违规。`)
  process.exit(1)
}
console.log(`${String(selected.length)} 道门禁全部通过。`)
