/**
 * 门禁：配置树引用的每个包，宿主都必须声明。
 *
 * 这是最值钱的一道 —— 它拦的正是我们第一天撞的那个坑：
 * cordis.yml 里写了一个包名，但 apps/cli 没把它列进 dependencies，
 * 于是 pnpm 不会为它建软链，loader 运行到那一行才炸。
 *
 * harness 有同名门禁，它的文档注释说得很直白：
 *   "either omission can otherwise fail only when Cordis loads the packaged plugin"
 *   （否则只有 Cordis 真正加载那个插件时才会失败）
 *
 * 顺带覆盖 patches/ —— patch 只能开关基线里已有的条目，
 * 但基线里那些 disabled: true 的备选项同样需要被声明，
 * 否则某个 profile 一打开就炸。
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import * as yaml from 'js-yaml'
import { allDeclared, type Gate, listPackages, type Violation } from './lib/workspace.ts'

interface Entry {
  id?: string
  name?: string
  config?: unknown
  [key: string]: unknown
}

/** 从一份 entry 列表里收集所有【裸包名】（相对路径不需要声明） */
function collectNames(data: unknown, out: Set<string>): void {
  if (Array.isArray(data)) {
    for (const item of data) collectNames(item, out)
    return
  }
  if (!data || typeof data !== 'object') return
  const entry = data as Entry
  if (
    typeof entry.name === 'string' &&
    !entry.name.startsWith('.') &&
    !entry.name.startsWith('cordis:')
  ) {
    out.add(entry.name)
  }
  // group 条目的 config 是嵌套的 entry 列表
  if (entry.config) collectNames(entry.config, out)
}

export const gate: Gate = {
  name: 'runtime-closure',
  guards: 'cordis.yml 与 patches/ 里引用的每个包，宿主都已声明',
  run(root) {
    const v: Violation[] = []
    for (const pkg of listPackages(root)) {
      if (pkg.kind !== 'app') continue
      const configPath = join(pkg.abs, 'cordis.yml')
      if (!existsSync(configPath)) continue

      /** 包名 → 它出现在哪个文件里（报错要指到那个文件，不能一律指 cordis.yml） */
      const origin = new Map<string, string>()
      const files = [configPath]
      const patchDir = join(pkg.abs, 'patches')
      if (existsSync(patchDir)) {
        for (const f of readdirSync(patchDir)) {
          if (f.endsWith('.yml') || f.endsWith('.yaml')) files.push(join(patchDir, f))
        }
      }

      for (const f of files) {
        const found = new Set<string>()
        // 不用 include 的 entryListSchema：门禁只关心 name 字段，
        // 而 !!js 表达式永远不会出现在 name 上（loader 明确规定元数据必须静态）
        let data: unknown
        try {
          data = yaml.load(readFileSync(f, 'utf-8'), { schema: yaml.JSON_SCHEMA })
        } catch {
          // 有 !!js 标签时 JSON_SCHEMA 会解析失败 —— 退回宽松模式只为提取 name
          data = yaml.load(readFileSync(f, 'utf-8').replace(/!!js\s+/g, ''), {
            schema: yaml.JSON_SCHEMA,
          })
        }
        collectNames(data, found)
        for (const name of found) if (!origin.has(name)) origin.set(name, relative(root, f))
      }

      const declared = allDeclared(pkg.manifest)
      for (const name of [...origin.keys()].sort()) {
        if (!declared.has(name)) {
          v.push({
            file: origin.get(name) ?? join(pkg.dir, 'cordis.yml'),
            message: `引用了 ${name}，但 ${pkg.manifest.name ?? pkg.dir} 没有声明它`,
            fix: `pnpm --filter ${pkg.manifest.name ?? pkg.dir} add ${name}`,
          })
        }
      }
    }
    return v
  },
}
