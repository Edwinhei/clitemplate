/**
 * ③ 消费方 —— 使用 notify 能力。
 *
 * ⚠️ 注意这个文件里【没有任何一处】提到 console / file / webhook。
 *    它只知道「有一块叫 notify 的招牌」。
 */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@ctl/notify'   // ← 只引入类型声明，运行时会被完全擦除

export const name = 'tool-notify'

/** 声明硬依赖：没有 notify 这块招牌，本插件不启动 */
export const inject = ['notify']

export async function apply(ctx: Context): Promise<void> {
  await ctx.notify.send({
    to: 'ops',
    title: 'CLI 启动完成',
    body: '这条消息由 tool-notify 发出，它不知道是谁在负责发送。',
  })
}
