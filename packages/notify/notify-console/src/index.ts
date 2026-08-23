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
    console.log(`📣 [${msg.to}] ${msg.title}${msg.body ? '\n   ' + msg.body : ''}`)
  }
}

export const name = 'notify-console'

export function apply(ctx: Context): void {
  ctx.plugin(ConsoleNotify)
}
