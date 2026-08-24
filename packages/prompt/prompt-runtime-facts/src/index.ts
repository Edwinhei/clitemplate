/**
 * ③'' 贡献方 —— 把运行时事实拼进 prompt。
 *
 * 演示 text 为什么可以是函数：**内容要反映组装那一刻的状态**。
 * 静态文本在插件加载时就定了；函数每次组装现算。
 *
 * 而且注意它拿环境值的方式 —— 走 ctx.env 服务，不碰 process.env。
 * prompt 里要塞什么事实是业务决定，读那些事实是宿主的职责，两件事分开。
 */

import type {} from '@ctl/env'
import type {} from '@ctl/prompt'
import type { Context } from '@deepseek-ai/cordis'

export const name = 'prompt-runtime-facts'

/** 同时要两块招牌：往 prompt 里放东西，从 env 里取事实 */
export const inject = ['prompt', 'env']

export function apply(ctx: Context): void {
  ctx.prompt.section({
    name: 'runtime-facts',
    order: -50, // 排在人格（0）之前、框架身份（-100）之后
    text: () => {
      const user = ctx.env.get('CTL_NOTIFY_TO')
      return [
        '<runtime>',
        `  当前用户：${user?.value ?? '未知'}（来源：${user?.source ?? '默认值'}）`,
        '</runtime>',
      ].join('\n')
    },
  })
}
