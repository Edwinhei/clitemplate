/**
 * Profile —— 同一份基线配置，按环境叠加不同的 patch。
 *
 * 为什么不是「每个环境一份完整配置」？因为那样会漂移：
 * 加一个插件要改 N 份文件，漏掉一份就是一次线上事故。
 * patch 的做法是「基线声明全部可能性，profile 只表达差异」。
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  applyEntryPatches,
  entryListSchema,
  type PatchOptions,
} from '@deepseek-ai/cordis-plugin-include'
import * as yaml from 'js-yaml'

/**
 * 读一份 patch 文件。
 *
 * 用 include 导出的 entryListSchema 解析 —— 必须和它同一种方言，
 * 否则 `!!js` 表达式节点解析不出来（那是 cordis.yml 支持的动态取值语法）。
 *
 * @param baseUrl  cordis.yml 所在目录
 * @param profile  profile 名，对应 patches/<profile>.yml
 * @returns patch 列表；文件不存在时抛错（拼错名字应该立刻失败，不该静默降级）
 */
export function loadProfilePatches(baseUrl: string, profile: string): PatchOptions[] {
  const path = fileURLToPath(new URL(`patches/${profile}.yml`, baseUrl))
  let text: string
  try {
    text = readFileSync(path, 'utf-8')
  } catch {
    throw new Error(`找不到 profile：${profile}（期望文件 ${path}）`)
  }
  const data = yaml.load(text, { schema: entryListSchema })
  if (data === null || data === undefined) return []
  if (!Array.isArray(data)) throw new Error(`patch 文件顶层必须是数组：${path}`)
  return data as PatchOptions[]
}

/**
 * 把基线配置和 patch 合起来，算出最终会挂载的条目列表 —— 但不启动任何东西。
 *
 * 关键：它调用的 applyEntryPatches 和【真正启动时】用的是同一个函数
 * （include 的官方注释说这个函数被 mounting 和离线 dump 共用，
 * 「所以 dump 永远不会和真正启动的东西脱节」）。
 *
 * 这就是 dump 的全部价值：它不是「另写一份预测逻辑」，
 * 而是走同一条代码路径。
 */
export function resolveEntries(configPath: string, patches: PatchOptions[]): unknown[] {
  const text = readFileSync(configPath, 'utf-8')
  const data = yaml.load(text, { schema: entryListSchema })
  if (!Array.isArray(data)) throw new Error(`config file must be a top-level array: ${configPath}`)
  const warnings: string[] = []
  const result = applyEntryPatches(data, patches, (message, ...args) => {
    // include 用 %C 做占位符，这里简单地把参数附在后面
    warnings.push(`${message.replaceAll('%C', '%s')} ${args.join(' ')}`)
  })
  for (const line of warnings) console.warn(`⚠️  ${line}`)
  return result
}

/** 把最终组合打印成 YAML，供人肉核对与 diff。 */
export function dumpConfig(configPath: string, patches: PatchOptions[]): string {
  return yaml.dump(resolveEntries(configPath, patches), { lineWidth: 100, noRefs: true })
}
