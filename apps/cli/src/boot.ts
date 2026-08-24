/**
 * 最小启动器。
 *
 * 它做五件事：
 *   1. 建一个根 Context —— 整个应用的「商场本体」
 *   2. 挂上 Loader —— 读配置、比对差异、挂载/卸载条目的那套能力
 *   3. 挂上日志 sink —— 必须早于配置树（见下）
 *   4. 让它去读 cordis.yml —— 「招商清单」
 *   5. 巡场一遍 —— 没能开业的当场报出来
 */
import { dirname } from 'node:path'
import { pathToFileURL } from 'node:url'
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import ConsoleExporter from '@deepseek-ai/cordis-plugin-logger-console'
import FileExporter from '@ctl/logger-file'
import { LaunchEnv, loadLaunchEnv } from '@ctl/env-launch'
import { assertEntriesActivated } from './audit.ts'

export async function boot(configPath: string): Promise<Context> {
  const ctx = new Context()

  // baseUrl 决定 cordis.yml 里的相对路径从哪里算起
  ctx.baseUrl = pathToFileURL(dirname(configPath)).href + '/'

  await ctx.plugin(Loader)

  // ═══════════════════════════════════════════════════════════════
  // 可观测性设施必须由宿主挂载，不能交给配置树
  // ═══════════════════════════════════════════════════════════════
  //
  // ctx.logger 是 Cordis 内置的、永远可用；但【没有 sink 时消息会被丢弃】——
  // 只进 ctx.logger.buffer，不会回放给后来挂上的 sink。
  //
  // 而配置树里的条目是 Promise.allSettled 并发 apply 的，YAML 里的先后
  // 不代表执行先后。也不能用 inject: ['logger'] 等它 —— logger 是 Context
  // 的内置属性，不在 registry 里，ctx.get('logger') 返回 undefined，
  // inject 它会永远 PENDING。
  //
  // 日志、追踪、指标、崩溃上报的价值恰恰在于覆盖启动最早期。
  // 放进配置树 = 放弃它们最该派上用场的那一段。
  await ctx.plugin(ConsoleExporter, { showTime: 'hh:mm:ss' })

  // ═══════════════════════════════════════════════════════════════
  // 引导期的环境事实
  // ═══════════════════════════════════════════════════════════════
  //
  // 配置树此刻还没加载，ctx.env 那块招牌根本不存在
  // （实测：这一行位置上 ctx.env === undefined）。
  //
  // 但我们不因此就裸读 process.env —— 而是调用和 @ctl/env-launch 插件
  // 【同一份】组装逻辑，拿到同一份分层快照。这样宿主和业务插件看到的
  // 环境永远一致，也不必把 env 提供方写死在宿主里。
  const env = new LaunchEnv(loadLaunchEnv({ baseUrl: ctx.baseUrl }))

  // 可选的文件 sink。sink 是可叠加的：每条消息会送到所有已注册的 sink。
  //
  // 只接受 shell / CI 显式传进来的值：运维开关不该被 app 自己的 .env 悄悄打开。
  // 这就是 getFrom 的用处 —— 省略 'app-env' 是拒绝，不是降级。
  const logFile = env.getFrom('CTL_LOG_FILE', ['process'])?.value
  if (logFile) await ctx.plugin(FileExporter, { path: logFile, levels: {} })

  // Include：真正去读那一份清单，把里面每一项挂成自己的子插件
  await ctx.loader.create({
    name: '@deepseek-ai/cordis-plugin-include',
    config: { path: configPath },
  })

  // 结算之后巡场：还没激活的条目，把它在等谁列出来
  await assertEntriesActivated(ctx, 'ctl')

  return ctx
}
