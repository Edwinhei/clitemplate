/**
 * ②' 另一个服务提供方 —— 把通知追加写进文件。
 *
 * 和 notify-console 一样实现 NotifyService 契约、一样挂 'notify' 这块招牌、
 * 一样不知道谁会用它。唯一的差别：它需要 Node 环境。
 * 所以只有这个包的 tsconfig 写了 types: ["node"]，只有它装了 @types/node。
 */
import { appendFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import type { Notification, NotifyService } from '@ctl/notify'
import { type Context, Service } from '@deepseek-ai/cordis'
import Schema from '@deepseek-ai/schemastery'

export interface Config {
  /** 落盘路径。相对路径以 cordis.yml 所在目录为基准 */
  path: string
}

/**
 * ★ 配置的形状声明。
 *
 * Cordis 在调用 apply 之前会拿它校验 cordis.yml 里的 config，
 * 不合法就在【启动时】报出「哪个字段、期望什么、实际是什么」——
 * 而不是等运行到 new URL(undefined) 才崩一句莫名其妙的 Invalid URL。
 *
 * 名字必须叫 Config（Cordis 认这个名字），和上面的 interface 同名做声明合并。
 */
export const Config: Schema<Config> = Schema.object({
  path: Schema.string().required().description('通知落盘路径，相对 cordis.yml 所在目录'),
})

class FileNotify extends Service implements NotifyService {
  /**
   * 解析好的绝对路径，构造时算一次。
   *
   * 注意这里【不能】写成 `constructor(ctx, private config: Config)` ——
   * 参数属性是 TS 独有语法，无法被擦除，会违反 erasableSyntaxOnly 约束。
   */
  private target: string

  constructor(ctx: Context, config: Config) {
    // 这一行就是「挂招牌」：把自己注册成名叫 notify 的服务
    super(ctx, 'notify')
    // ctx.baseUrl 是 loader 注入的「配置文件所在目录」。
    // 用它做基准，配置里就能写相对路径，而不用关心进程在哪儿启动。
    this.target = fileURLToPath(new URL(config.path, ctx.baseUrl))
  }

  async send(msg: Notification): Promise<void> {
    // 和 notify-console 一样的两句 —— 这是【提供方的契约义务】，
    // 不是可选项：漏掉的话，策略层和统计层对这个提供方就全失效了。
    if (this.ctx.bail('notify/before-send', msg)) return

    const line = `[${msg.to}] ${msg.title}${msg.body ? ` | ${msg.body}` : ''}\n`
    await appendFile(this.target, line, 'utf-8')
    // 显式指定名字：不写会用类名推导出的 'file-notify'，和包名对不上
    this.ctx.logger('notify-file').info('已写入 %s', this.target)
    this.ctx.emit('notify/sent', msg)
  }
}

export const name = 'notify-file'

export function apply(ctx: Context, config: Config): void {
  ctx.plugin(FileNotify, config)
}
