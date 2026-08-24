/**
 * ② 提供方 A —— 把启动进程继承的环境变量做成快照。
 *
 * 全仓库只有这个包碰 process.env。它是唯一带 types: ["node"] 的 host 包。
 */
import { Service, type Context } from '@deepseek-ai/cordis'
import type { EnvService, EnvValue } from '@ctl/env'

class ProcessEnv extends Service implements EnvService {
  private data: Record<string, EnvValue>

  constructor(ctx: Context) {
    // 挂招牌
    super(ctx, 'env')

    // null 原型：避免 'constructor' / '__proto__' 这类变量名撞上 Object.prototype
    this.data = Object.create(null) as Record<string, EnvValue>

    // ★ 启动时拍一次快照。
    //   process.env 是可变全局，任何第三方库都能中途改它。
    //   拍成照片之后，「环境」就从一个会动的东西变成一个确定的事实。
    for (const [name, value] of Object.entries(process.env)) {
      if (value !== undefined) this.data[name] = { value, source: 'process' }
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

export const name = 'env-process'

export function apply(ctx: Context): void {
  ctx.plugin(ProcessEnv)
}
