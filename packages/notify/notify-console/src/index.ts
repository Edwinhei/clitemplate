/**
 * ② 服务提供方 —— 把通知打到控制台。
 *
 * 它实现契约，但【不知道谁会用它】。
 */
import { Service, type Context } from '@deepseek-ai/cordis'
import type { Notification, NotifyService } from '@ctl/notify'

class ConsoleNotify extends Service implements NotifyService {
  constructor(ctx: Context) {
    // 这一行就是「挂招牌」：把自己注册成名叫 notify 的服务
    super(ctx, 'notify')
  }

  async send(msg: Notification): Promise<void> {
    // ① 先问一声有没有人要拦。
    //    bail 的语义是「挨个问，谁先给出非空结果就用谁的，后面的不再问」——
    //    没有任何监听器时返回 undefined，等于放行。
    if (this.ctx.bail('notify/before-send', msg)) return

    // 走 ctx.logger 而不是 console.log —— 它自己也是一块招牌，
    // 所以通知内容最终去哪儿（终端 / 文件 / 远程）由装配层决定。
    // 显式指定 logger 名字，不写会用类名推导出的 'console-notify'，和包名对不上。
    this.ctx.logger('notify-console').info('[%s] %s%s', msg.to, msg.title, msg.body ? ' | ' + msg.body : '')

    // ② 投递完了广播一声。emit 喊完就走，不等任何人，
    //    也不关心有没有人在听 —— 这正是「我不该知道谁关心」。
    this.ctx.emit('notify/sent', msg)
  }
}

export const name = 'notify-console'

export function apply(ctx: Context): void {
  ctx.plugin(ConsoleNotify)
}
