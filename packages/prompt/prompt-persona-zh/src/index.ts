/**
 * ③ 贡献方 —— 中文人格。
 *
 * 这是模板里的【第五种角色】。前面四种是：
 *   契约 / 提供方 / 消费方 / 观察方
 * 贡献方的特别之处：它既 inject 一个服务，又往那个服务里【放东西】。
 *
 * ⚠️ 它和 en 版占【同一个槽位名】。两个都挂上时，后加载的顶掉先加载的 ——
 *    这正是本条 seam 与 notify seam 的差别所在。
 */

import type {} from '@ctl/prompt'
import type { Context } from '@deepseek-ai/cordis'

/** 人格槽位。两种语言取同一个名字，替换才成立 */
export const PERSONA_SECTION = 'persona'

export const name = 'prompt-persona-zh'
export const inject = ['prompt']

export function apply(ctx: Context): void {
  ctx.prompt.section({
    name: PERSONA_SECTION,
    order: 0,
    // 中文和英文【不是互相翻译】——
    // 模型对不同语言的指令遵循度不同，同一个意图往往要用不同的写法。
    // 英文里一句 "Be concise." 很有效；中文直译「要简洁」效果差很多，
    // 得写成下面这种可度量的形式。
    text: [
      '你是一个命令行助手。',
      '回答控制在三句话以内，不要复述用户的问题。',
      '不确定时直说不确定，不要猜。',
    ].join('\n'),
  })
}
