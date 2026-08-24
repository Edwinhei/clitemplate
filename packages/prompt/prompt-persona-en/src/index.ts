/**
 * ③' 贡献方 —— 英文人格。占的是和 zh 版【同一个槽位】。
 *
 * 注意这两份不是互相翻译的结果，而是两份【各自调优的正本】。
 * harness 那 1146 个 *.i18n.yaml 里有一句话说的就是这件事：
 *   "Both languages carry equal authority"
 */

import type {} from '@ctl/prompt'
import type { Context } from '@deepseek-ai/cordis'

export const PERSONA_SECTION = 'persona'

export const name = 'prompt-persona-en'
export const inject = ['prompt']

export function apply(ctx: Context): void {
  ctx.prompt.section({
    name: PERSONA_SECTION,
    order: 0,
    text: ['You are a command-line assistant.', 'Be concise.', "Say so when you don't know."].join(
      '\n',
    ),
  })
}
