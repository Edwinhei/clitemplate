/**
 * ⑤ 策略方 —— 一票否决。
 *
 * 包名里的 `-policy` 后缀在命名规范里的含义是「随便摘」：
 * 摘掉这个包，通知照发，只是没人拦了。
 * 这和提供方（摘了就没人挂招牌）、消费方（摘了功能就没了）都不同。
 *
 * 它演示的是 bail 派发 —— 挨个问，谁先给出非空结果就用谁的，后面的不再问。
 * 和 emit（喊完就走）相比：
 *   emit  广播既成事实，没人能改变它
 *   bail  征求意见，任何一个都能改变结果
 */
import type { Context } from '@deepseek-ai/cordis'
import Schema from '@deepseek-ai/schemastery'
import type { Notification } from '@ctl/notify'

export interface Config {
  /** 安静时段的收件人名单，命中就拦下 */
  mute: string[]
}

export const Config: Schema<Config> = Schema.object({
  mute: Schema.array(Schema.string()).default([]).description('这些收件人的通知一律拦下'),
})

export const name = 'notify-quiet-policy'

export function apply(ctx: Context, config: Config): void {
  const muted = new Set(config.mute)

  ctx.on('notify/before-send', (msg: Notification) => {
    if (!muted.has(msg.to)) return              // ⚠️ 必须 return undefined 才是放行
    ctx.logger('notify-quiet-policy').info('拦下发给 %s 的通知：%s', msg.to, msg.title)
    return true                                  // 非空结果 = 我接了 = 取消投递
  })
}
