/**
 * ③ 消费方 —— 使用 notify 和 env 两块招牌。
 *
 * ⚠️ 这个文件里没有任何一处提到 console / file / process。
 *    它不知道通知怎么发出去，也不知道环境值从哪儿读来。
 *    两件事都由 cordis.yml 决定。
 */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@ctl/notify'   // 只引类型声明，运行时被完全擦除
import type {} from '@ctl/env'

export const name = 'tool-notify'

/** 依赖全部显形在这一行 —— 没有隐藏在函数体里的 process.env */
export const inject = ['notify', 'env']

export async function apply(ctx: Context): Promise<void> {
  // 通过服务拿宿主事实，而不是 process.env.CTL_NOTIFY_TO
  const found = ctx.env.get('CTL_NOTIFY_TO')
  const to = found?.value ?? 'ops'


  await ctx.notify.send({
    to,
    title: 'CLI 启动完成',
    // 把来源一起打出来，好让实验能看见「值是从哪一层来的」
    body: `收件人 ${to} 来自 ${found?.source ?? '(默认值)'}`,
  })
}
