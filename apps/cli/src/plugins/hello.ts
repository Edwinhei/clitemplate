/**
 * 最小的本地插件。
 *
 * 用 ctx.logger 而不是 console.log：
 *   · 自带来源 —— logger 名字取自插件的 name，不用自己拼前缀
 *   · 有级别 —— error(0) / info(1) / warn(2) / debug(3)，阈值可按名字单独调
 *   · 可重定向 —— 换 exporter 就写文件 / 送远程，这里一个字不改
 *
 * 注意【不要】写 inject: ['logger']：
 * logger 是 Context 的内置属性，不在 registry 里，inject 它会永远 PENDING。
 * 基础 sink 由 boot.ts 保证先就位。
 */
import type { Context } from '@deepseek-ai/cordis'

export const name = 'hello'

export function apply(ctx: Context): void {
  ctx.logger.info('hello 插件启动了')
  ctx.logger.debug('这条默认看不见 —— debug(3) 高于默认阈值 info(1)')
}
