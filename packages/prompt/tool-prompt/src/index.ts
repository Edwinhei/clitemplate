/**
 * ④ 消费方 —— 把组装好的 prompt 打出来。
 *
 * 真实项目里这里是「把 prompt 发给模型」。模板不接模型，只演示组装 ——
 * 因为要学的是【结构】，不是 API 调用。
 *
 * 注意它和贡献方的差别：
 *   贡献方  inject ['prompt'] + 往里放东西
 *   消费方  inject ['prompt'] + 从里取东西
 * 两者都不知道对方存在。
 */

import type {} from '@ctl/prompt'
import type { Context } from '@deepseek-ai/cordis'

export const name = 'tool-prompt'
export const inject = ['prompt']

export function apply(ctx: Context): void {
  const log = ctx.logger('tool-prompt')

  // 先打来源清单 —— 排查「这句话是谁加的」时，这个比 prompt 本身还有用
  const sections = ctx.prompt.list()
  log.info(
    '共 %d 段：%s',
    sections.length,
    sections.map((s) => `${s.name}(${String(s.order)})`).join(' → '),
  )

  log.info('组装结果：\n%s', ctx.prompt.assemble())
}
