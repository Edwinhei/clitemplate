/**
 * 第一个插件。
 *
 * 注意它有多「无知」：
 *   - 不知道自己会被谁挂载
 *   - 不知道 cordis.yml 长什么样
 *   - 只知道「有人会给我一个 ctx」
 *
 * 这就是 Cordis 的核心契约：ctx 是【框架递进来的参数】，不是你去 import 的东西。
 */
import type { Context } from '@deepseek-ai/cordis'

export const name = 'hello'

export function apply(_ctx: Context) {
  console.log('👋 hello 插件启动了')
}
