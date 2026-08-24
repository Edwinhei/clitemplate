/**
 * 门禁：版本号只写一处。
 *
 * 守的约束：外部依赖一律走 catalog，版本号只在 pnpm-workspace.yaml 出现。
 *
 * 为什么这条比 peer 更重要 —— **peer 管不了版本一致**。
 * 实测过：宿主装 is-odd@2、插件 peer 要求 ^3，pnpm 一句警告都没有，
 * 直接给插件另装一份，两份实体静默共存，instanceof 当场翻车。
 * 只有把版本收口，「版本分叉」才在物理上不可能发生。
 *
 * ⚠️ 但「收口」不等于「全仓库只能有一个版本」。
 * 不同的 app 对同一个库依赖不同大版本，是完全正常的
 * （比如 web 用 react 19、marketing 的旧站还在 18）。
 * pnpm 的答案是【具名目录】：
 *
 *   catalog:                    # 默认目录
 *     react: '^19.0.0'
 *   catalogs:
 *     legacy:                   # 具名目录
 *       react: '^18.3.1'
 *
 *   "react": "catalog:"         → 19
 *   "react": "catalog:legacy"   → 18
 *
 * 关键在于：**版本号依然只写在 pnpm-workspace.yaml 里。**
 * 门禁要拦的是「散落在各个 package.json 里的硬版本」，
 * 不是「全仓库只准有一个版本」—— 那是两件事。
 */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import * as yaml from 'js-yaml'
import { listPackages, type Gate, type Violation } from './lib/workspace.ts'

/** workspace 内部引用走 workspace: 协议，不进 catalog */
const INTERNAL_PREFIX = '@ctl/'

interface WorkspaceYaml {
  catalog?: Record<string, string>
  catalogs?: Record<string, Record<string, string>>
}

/** 读出所有目录：默认目录记为 'default' */
function readCatalogs(root: string): Map<string, Record<string, string>> {
  const out = new Map<string, Record<string, string>>()
  const path = join(root, 'pnpm-workspace.yaml')
  if (!existsSync(path)) return out
  const data = yaml.load(readFileSync(path, 'utf-8')) as WorkspaceYaml | null
  if (!data) return out
  if (data.catalog) out.set('default', data.catalog)
  for (const [name, entries] of Object.entries(data.catalogs ?? {})) out.set(name, entries)
  return out
}

export const gate: Gate = {
  name: 'catalog',
  guards: '外部依赖一律走 catalog，版本号只在 pnpm-workspace.yaml 出现',
  run(root) {
    const v: Violation[] = []
    const catalogs = readCatalogs(root)

    for (const pkg of listPackages(root)) {
      const m = pkg.manifest
      const file = join(pkg.dir, 'package.json')

      for (const field of ['dependencies', 'devDependencies', 'peerDependencies'] as const) {
        for (const [name, range] of Object.entries(m[field] ?? {})) {
          // ── 仓库内部的包 ──
          if (name.startsWith(INTERNAL_PREFIX)) {
            if (range !== 'workspace:*') {
              v.push({ file, message: `${field}.${name} = "${range}"`, fix: '仓库内部的包一律 "workspace:*"' })
            }
            continue
          }

          // ── 外部依赖：必须是 catalog: 或 catalog:<名字> ──
          if (!range.startsWith('catalog:')) {
            v.push({
              file,
              message: `${field}.${name} 写了硬版本 "${range}"`,
              fix: '改成 "catalog:"，把版本号加进 pnpm-workspace.yaml 的 catalog 段',
            })
            continue
          }

          // ── 引用的目录必须真的存在 ──
          // 拼错目录名 pnpm 会报错，但那是 install 时；门禁能提前一步
          const which = range.slice('catalog:'.length) || 'default'
          const entries = catalogs.get(which)
          if (!entries) {
            v.push({
              file,
              message: `${field}.${name} 引用了不存在的目录 "${which}"`,
              fix: which === 'default'
                ? 'pnpm-workspace.yaml 里还没有 catalog: 段'
                : `pnpm-workspace.yaml 的 catalogs: 下面加一个 ${which}:`,
            })
            continue
          }
          if (!(name in entries)) {
            v.push({
              file,
              message: `${field}.${name} 用了目录 "${which}"，但那个目录里没有这个包`,
              fix: `把 ${name} 加进 pnpm-workspace.yaml 中 ${which === 'default' ? 'catalog:' : `catalogs.${which}:`} 段`,
            })
          }
        }
      }
    }
    return v
  },
}
