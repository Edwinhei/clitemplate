/**
 * 最小启动器。
 *
 * 它只做三件事：
 *   1. 建一个根 Context —— 整个应用的「商场本体」
 *   2. 挂上 Loader —— 「招商部」，负责照单办事
 *   3. 让它去读 cordis.yml —— 「招商清单」
 *
 * 后续步骤会往这里加：启动审计（步骤 4）、宿主注入（步骤 5）、日志（步骤 7）。
 * 现在保持最小，一次只理解一个概念。
 */
import { dirname } from 'node:path'
import { pathToFileURL } from 'node:url'
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'

export async function boot(configPath: string): Promise<Context> {
  const ctx = new Context()

  // baseUrl 决定 cordis.yml 里的相对路径从哪里算起
  ctx.baseUrl = pathToFileURL(dirname(configPath)).href + '/'

  // Loader：读配置、比对差异、挂载/卸载条目的那套能力
  await ctx.plugin(Loader)

  // Include：真正去读某一份清单，把里面每一项挂成自己的子插件
  await ctx.loader.create({
    name: '@deepseek-ai/cordis-plugin-include',
    config: { path: configPath },
  })

  return ctx
}
