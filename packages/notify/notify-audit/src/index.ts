/**
 * ④ 观察方 —— 通知发出去之后记一笔账。
 *
 * 这是第四种角色，前面三种是契约 / 提供方 / 消费方。
 *
 * 它和消费方（tool-notify）的差别值得琢磨：
 *   · 消费方【主动要一个能力】—— inject: ['notify']，没有它就不开业
 *   · 观察方【被动等一件事发生】—— 不 inject 任何东西，有没有 notify 都能活
 *
 * 换句话说：**服务是「我需要你」，事件是「你发生了我想知道」。**
 * 方向相反，耦合强度也完全不同。
 *
 * 注意这个包【不 inject notify】—— 它不用 ctx.notify，只听事件。
 * 所以就算全场没有任何 notify 提供方，它照样正常启动，只是永远收不到事件。
 */
import type { Context } from '@deepseek-ai/cordis'
import type { Notification } from '@ctl/notify'

export const name = 'notify-audit'

export function apply(ctx: Context): void {
  // 计数放在 apply 的闭包里，不放模块顶层 ——
  // 模块顶层的状态活到进程结束，热重载时不会被重置（13 篇「HMR 救不了的三种情况」）
  let count = 0
  const byRecipient = new Map<string, number>()

  // ctx.on 返回的是一张复原单：插件被卸载时监听器自动摘掉，
  // 不需要手写 off。这就是 05 篇说的「一切注册都是 effect」。
  ctx.on('notify/sent', (msg: Notification) => {
    count += 1
    byRecipient.set(msg.to, (byRecipient.get(msg.to) ?? 0) + 1)
    ctx.logger('notify-audit').info(
      '第 %d 条已投递 → %s（此人共 %d 条）',
      count, msg.to, byRecipient.get(msg.to),
    )
  })
}
