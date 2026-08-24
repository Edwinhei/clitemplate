/**
 * 启动环境 —— 这一次运行的环境事实，组装成一份不可变的分层快照。
 *
 * 这个包有两个面孔，服务两拨完全不同的消费者：
 *
 *   ① loadLaunchEnv()  纯函数。给【宿主引导期】用。
 *      boot 需要 CTL_LOG_FILE 之类的运维开关时，配置树还没加载，
 *      ctx.env 这块招牌根本不存在（实测：此刻 ctx.env === undefined）。
 *      所以宿主直接调这个函数，不经过服务。
 *
 *   ② apply()          插件。给【配置树里的业务插件】用。
 *      它把同一份快照挂成 ctx.env 招牌，业务插件通过 inject 拿。
 *
 * 一份加载逻辑，两个入口 —— 这样两边看到的环境永远是同一份事实。
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { EnvService, EnvValue } from '@ctl/env'
import { type Context, Service } from '@deepseek-ai/cordis'

/**
 * 层的名字，也就是 EnvValue.source 的取值。
 *
 * 顺序即信任度，越靠前越可信：
 *   process  —— 启动它的 shell / CI / 容器显式传进来的，是这次运行的明确意图
 *   app-env  —— app 自己目录下的 .env，是这个应用的默认值
 */
export const LAYERS = ['process', 'app-env'] as const
export type Layer = (typeof LAYERS)[number]

export interface LoadOptions {
  /** .env 文件所在目录的 URL，通常就是 cordis.yml 所在目录。为空则不读文件层 */
  baseUrl: string | undefined
  /** 文件名，默认 .env */
  fileName?: string
}

/**
 * 极简 .env 解析。只认最常见的三种写法：
 *   KEY=value / KEY="value" / KEY='value'
 * 不支持变量插值、多行值、export 前缀 —— 需要的话换 dotenv，
 * 但那样就多一个运行时依赖，这里刻意不引。
 */
function parseDotenv(text: string): Record<string, string> {
  const result: Record<string, string> = Object.create(null) as Record<string, string>
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq <= 0) continue
    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    result[key] = value
  }
  return result
}

/**
 * 组装这一次运行的环境快照。
 *
 * 拍成快照而不是实时读：process.env 是可变全局，任何第三方库都能中途改它。
 * 照片一旦拍下，「环境」就从会动的东西变成确定的事实。
 *
 * @returns 名字 → { value, source }。同名时靠前的层胜出。
 */
export function loadLaunchEnv(options: LoadOptions): Record<string, EnvValue> {
  const data = Object.create(null) as Record<string, EnvValue>

  // 低信任层先写入，高信任层后覆盖 —— 这样「后写的赢」等于「越可信的赢」
  try {
    if (!options.baseUrl) throw new Error('no baseUrl')
    const path = fileURLToPath(new URL(options.fileName ?? '.env', options.baseUrl))
    for (const [name, value] of Object.entries(parseDotenv(readFileSync(path, 'utf-8')))) {
      data[name] = { value, source: 'app-env' }
    }
  } catch {
    // 没有 .env 是正常情况，不是错误
  }

  for (const [name, value] of Object.entries(process.env)) {
    if (value !== undefined) data[name] = { value, source: 'process' }
  }

  return data
}

/** 把一份现成的快照包装成 EnvService。宿主和插件共用这一个实现。 */
export class LaunchEnv implements EnvService {
  // 不能写成 constructor(private data: …) —— 参数属性是 TS 独有语法，
  // 无法擦除，会违反 erasableSyntaxOnly
  private data: Record<string, EnvValue>

  constructor(data: Record<string, EnvValue>) {
    this.data = data
  }

  get(name: string): EnvValue | undefined {
    return this.data[name]
  }

  /**
   * 只接受来自指定层的值。
   *
   * 不列出某一层 = 明确拒绝它，而不是把它降级。
   * 比如密钥只肯接受 shell 传进来的：getFrom('API_KEY', ['process'])
   * —— 将来层数变多、优先级调整，app-env 也永远混不进去。
   */
  getFrom(name: string, sources: string[]): EnvValue | undefined {
    const found = this.data[name]
    return found && sources.includes(found.source) ? found : undefined
  }

  require(name: string): string {
    const found = this.get(name)
    if (!found) throw new Error(`缺少必需的环境变量：${name}`)
    return found.value
  }

  snapshot(): Record<string, EnvValue> {
    return { ...this.data }
  }
}

class LaunchEnvService extends Service implements EnvService {
  private impl: LaunchEnv

  constructor(ctx: Context) {
    super(ctx, 'env')
    // 插件这一侧同样走 loadLaunchEnv，和宿主看到的是同一份组装逻辑
    this.impl = new LaunchEnv(loadLaunchEnv({ baseUrl: ctx.baseUrl }))
  }

  get(name: string): EnvValue | undefined {
    return this.impl.get(name)
  }
  getFrom(name: string, sources: string[]): EnvValue | undefined {
    return this.impl.getFrom(name, sources)
  }
  require(name: string): string {
    return this.impl.require(name)
  }
  snapshot(): Record<string, EnvValue> {
    return this.impl.snapshot()
  }
}

export const name = 'env-launch'

export function apply(ctx: Context): void {
  ctx.plugin(LaunchEnvService)
}
