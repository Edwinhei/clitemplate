/**
 * 启动器。
 *
 * 顺序是有讲究的，每一步都解决一个「引导期需要、但配置树还没就绪」的问题：
 *
 *   1. 建根 Context
 *   2. 挂 Loader —— 读配置、比对差异、挂载/卸载条目的那套能力
 *   3. 组装环境快照 —— 引导期的决策要用它（配置树此刻还没加载）
 *   4. 挂日志 sink —— 必须早于配置树，否则最早那批日志会被丢弃
 *   5. 可选挂 HMR —— 它自带文件监视器，会把进程钉住
 *   6. 读 cordis.yml —— 「招商清单」
 *   7. 把 cordis.yml 也接上 HMR —— 改配置不重启就生效
 *   8. 巡场 —— 没能开业的当场报出来
 */
import { dirname } from 'node:path'
import { pathToFileURL } from 'node:url'
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import Timer from '@deepseek-ai/cordis-plugin-timer'
import Hmr from '@deepseek-ai/cordis-plugin-hmr'
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
  // 引导期的环境事实
  // ═══════════════════════════════════════════════════════════════
  // 配置树此刻还没加载，ctx.env 那块招牌根本不存在
  // （实测：这一行位置上 ctx.env === undefined）。
  //
  // 但不因此就裸读 process.env —— 调用和 @ctl/env-launch 插件【同一份】
  // 组装逻辑，拿到同一份分层快照。宿主和业务插件看到的环境永远一致。
  const env = new LaunchEnv(loadLaunchEnv({ baseUrl: ctx.baseUrl }))

  // 运维开关只接受 shell / CI 层。省略 'app-env' 是拒绝，不是降级 ——
  // 提交进版本库的 .env 不该有能力打开这些开关。
  const flag = (key: string): string | undefined => env.getFrom(key, ['process'])?.value

  // ═══════════════════════════════════════════════════════════════
  // 可观测性设施必须由宿主挂载，不能交给配置树
  // ═══════════════════════════════════════════════════════════════
  // ctx.logger 是内置的、永远可用；但没有 sink 时消息会被静默丢弃
  // （只进 ctx.logger.buffer，不会回放给后来挂上的 sink）。
  // 而配置树条目是 Promise.allSettled 并发 apply 的，YAML 里的先后
  // 不代表执行先后；也不能 inject: ['logger'] —— 那是 Context 内置属性，
  // 不在 registry 里，ctx.get('logger') 返回 undefined，会永远 PENDING。
  await ctx.plugin(ConsoleExporter, { showTime: 'hh:mm:ss' })

  const logFile = flag('CTL_LOG_FILE')
  if (logFile) await ctx.plugin(FileExporter, { path: logFile, levels: {} })

  // ═══════════════════════════════════════════════════════════════
  // 热重载（可选，CTL_WATCH=1 打开）
  // ═══════════════════════════════════════════════════════════════
  // 这是一次【运行形态的切换】，不是一个普通配置项：
  // HMR 自带 chokidar 文件监视器，那是个长期句柄 —— 装上它进程就不会
  // 自己退出了。一次性 CLI 默认不该这样，所以走显式开关。
  const watch = !!flag('CTL_WATCH')
  if (watch) {
    // HMR 声明了 static inject = ['loader', 'timer']，timer 不挂它就永远 PENDING
    await ctx.plugin(Timer)
    await ctx.plugin(Hmr, {
      // 监视范围：本 app 的源码 + 所有能力包的源码
      root: ['src', '../../packages'],
      debounce: 100,
      ignored: ['**/node_modules/**', '**/*.log'],
    })
  }

  // Include：真正去读那一份清单，把里面每一项挂成自己的子插件
  const includeId = await ctx.loader.create({
    name: '@deepseek-ai/cordis-plugin-include',
    config: { path: configPath },
  })

  // ═══════════════════════════════════════════════════════════════
  // 把 cordis.yml 本身也接上监视
  // ═══════════════════════════════════════════════════════════════
  // HMR 的主监视器只认【模块】（root 下的 .ts/.js）。cordis.yml 不是模块，
  // 所以要用 registerConfig 单独挂一条精确路径的监视。
  //
  // 而 include 插件【不会自己接】—— 接线是宿主的职责。
  // Include 实例就是那条 entry 的 subtree，它有个公开的 refresh()：
  // 「重读文件，内容变了就事务性地刷新子条目」。
  if (watch) {
    for (const entry of ctx.loader.entries()) {
      if (entry.options.id !== includeId) continue
      const tree = entry.subtree as { refresh?: () => Promise<void> } | undefined
      if (typeof tree?.refresh === 'function') {
        await ctx.hmr.registerConfig(configPath, () => tree.refresh!())
        ctx.logger('boot').info('cordis.yml 已接入热重载')
      }
      break
    }
  }

  // 结算之后巡场：还没激活的条目，把它在等谁列出来
  await assertEntriesActivated(ctx, 'ctl')

  return ctx
}
