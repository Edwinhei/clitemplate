/**
 * 门禁：版本号只写一处。
 *
 * 守的约束：外部依赖一律 "catalog:"，版本号只在 pnpm-workspace.yaml 出现。
 *
 * 为什么这条比 peer 更重要：peer 【管不了】版本一致。
 * 实测过 —— 宿主装 is-odd@2、插件 peer 要求 ^3，pnpm 一句警告都没有，
 * 直接给插件另装一份，两份实体静默共存。
 * 只有把版本收口到一处，「版本分叉」才在物理上不可能发生。
 */
import { join } from 'node:path'
import { listPackages, type Gate, type Violation } from './lib/workspace.ts'

/** workspace 内部引用用 workspace: 协议，不进 catalog */
const INTERNAL_PREFIX = '@ctl/'

export const gate: Gate = {
  name: 'catalog',
  guards: '外部依赖一律 catalog:，版本号只在 pnpm-workspace.yaml 出现',
  run(root) {
    const v: Violation[] = []
    for (const pkg of listPackages(root)) {
      const m = pkg.manifest
      const file = join(pkg.dir, 'package.json')
      for (const field of ['dependencies', 'devDependencies', 'peerDependencies'] as const) {
        for (const [name, range] of Object.entries(m[field] ?? {})) {
          if (name.startsWith(INTERNAL_PREFIX)) {
            if (range !== 'workspace:*') {
              v.push({ file, message: `${field}.${name} = "${range}"`, fix: '仓库内部的包一律 "workspace:*"' })
            }
            continue
          }
          if (range !== 'catalog:') {
            v.push({
              file,
              message: `${field}.${name} 写了硬版本 "${range}"`,
              fix: '改成 "catalog:"，把版本号加进 pnpm-workspace.yaml 的 catalog 段',
            })
          }
        }
      }
    }
    return v
  },
}
