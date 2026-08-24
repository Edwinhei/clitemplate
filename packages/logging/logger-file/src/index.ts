/**
 * logger exporter —— 把结构化日志以 JSON Lines 追加写入文件。
 *
 * 注意这个包【没有契约包】。
 * 因为契约（LoggerService + Exporter 接口）是 Cordis 内置的 ——
 * 契约不一定要自己写，框架给了就直接用。
 *
 * 它和官方的 logger-console 是同一个位置上的两个提供方：
 * 都实现 Exporter，都往 ctx.logger 上挂 sink，消费方分辨不出差别。
 */
import { appendFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { Logger, type Context, type Exporter, type Message } from '@deepseek-ai/cordis'
import Schema from '@deepseek-ai/schemastery'

export interface Config {
  /** 落盘路径，相对 cordis.yml 所在目录 */
  path: string
  /** 每个 logger 名字的阈值：0=error 1=info 2=warn 3=debug，默认 1 */
  levels: Record<string, number>
}

export const Config: Schema<Config> = Schema.object({
  path: Schema.string().required().description('日志文件路径，相对 cordis.yml 所在目录'),
  levels: Schema.dict(Schema.number()).default({}).description('按 logger 名字设置阈值'),
})

export class FileExporter implements Exporter {
  static readonly name = 'logger-file'
  static readonly Config = Config

  /** Exporter 接口读这个字段做过滤，直接透传配置 */
  levels: Record<string, number>

  /** 文件里不需要 ANSI 转义，关掉颜色 */
  colors = false as const

  private target: string

  constructor(ctx: Context, config: Config) {
    this.levels = config.levels
    this.target = fileURLToPath(new URL(config.path, ctx.baseUrl))
    // ★ 把自己注册成一个 sink。
    //   exporter() 返回的 disposable 挂在当前 fiber 上 ——
    //   插件被卸载时 sink 自动摘除，不需要手动清理。
    ctx.logger.exporter(this)
  }

  export(message: Message): void {
    // 用同步写：这是个 CLI，进程可能在异步写落盘前就退出。
    // 长驻服务应该换成带 flush 的异步队列，代价是要处理退出时的收尾。
    appendFileSync(this.target, JSON.stringify({
      ts: new Date(message.ts).toISOString(),
      sn: message.sn,
      name: message.name,
      type: message.type,
      // 原样保留结构化参数，机器可读
      args: message.args,
      // 同时存一份渲染好的文本，人可读。Logger.format 负责解 printf 占位符
      msg: Logger.format(this, message),
    }) + '\n', 'utf-8')
  }
}

export default FileExporter
