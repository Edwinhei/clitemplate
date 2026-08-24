/**
 * ② 提供方 B —— 值直接来自 cordis.yml 的配置。
 *
 * 不碰 process，所以测试、浏览器、云端沙箱里都能用。
 * 它和 env-process 挂同一块招牌，消费方分辨不出差别 —— 这正是重点。
 */
import { Service, type Context } from '@deepseek-ai/cordis'
import Schema from '@deepseek-ai/schemastery'
import type { EnvService, EnvValue } from '@ctl/env'

export interface Config {
  /** 直接写死的环境值 */
  values: Record<string, string>
}

/** ★ 配置校验：values 必须是「字符串 → 字符串」的字典，缺省是空字典 */
export const Config: Schema<Config> = Schema.object({
  values: Schema.dict(Schema.string()).default({}).description('写死的环境值'),
})

class StaticEnv extends Service implements EnvService {
  private data: Record<string, EnvValue>

  constructor(ctx: Context, config: Config) {
    super(ctx, 'env')
    this.data = Object.create(null) as Record<string, EnvValue>
    for (const [name, value] of Object.entries(config.values)) {
      this.data[name] = { value, source: 'static' }
    }
  }

  get(name: string): EnvValue | undefined {
    return this.data[name]
  }

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

export const name = 'env-static'

export function apply(ctx: Context, config: Config): void {
  ctx.plugin(StaticEnv, config)
}
