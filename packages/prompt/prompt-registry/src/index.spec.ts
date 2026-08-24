/**
 * 怎么测一个 Cordis 服务。
 *
 * 关键是：**不需要 loader、不需要 cordis.yml、不需要任何配置文件。**
 * `new Context()` + `ctx.plugin()` 就是一个完整可用的容器 ——
 * 这也是「Cordis 是运行时的编排，不是构建时的框架」的一个侧面。
 */
import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'

import { apply } from './index.ts'

/** 造一个装好注册表的 ctx */
async function setup(): Promise<Context> {
  const ctx = new Context()
  await ctx.plugin({ name: 'prompt-registry', apply })
  return ctx
}

/** 模拟一个贡献方：它有自己的 fiber，卸载时注册要跟着消失 */
function contribute(ctx: Context, name: string, order: number, text: string) {
  return ctx.plugin({
    name: `contributor-${name}`,
    inject: ['prompt'],
    apply(c: Context) {
      c.prompt.section({ name, order, text })
    },
  })
}

describe('prompt 注册表', () => {
  it('按 order 升序拼接，不按注册顺序', async () => {
    const ctx = await setup()
    await contribute(ctx, 'late', 100, '最后一段')
    await contribute(ctx, 'early', -100, '第一段')
    expect(ctx.prompt.assemble()).toBe('第一段\n\n最后一段')
  })

  it('同名即替换 —— 这是本条 seam 的核心语义', async () => {
    const ctx = await setup()
    await contribute(ctx, 'persona', 0, '中文人格')
    await contribute(ctx, 'persona', 0, '英文人格')
    // 不报错、不重复，只剩一段
    expect(ctx.prompt.list()).toHaveLength(1)
    expect(ctx.prompt.assemble()).toBe('英文人格')
  })

  it('贡献方被卸载，它那段自动消失', async () => {
    const ctx = await setup()
    await contribute(ctx, 'keep', 0, '留下的')
    const temp = await contribute(ctx, 'temp', 10, '临时的')

    expect(ctx.prompt.list()).toHaveLength(2)
    await temp.dispose()
    // 不需要任何反注册代码 —— 注册本身是一笔 effect
    expect(ctx.prompt.list()).toHaveLength(1)
    expect(ctx.prompt.assemble()).toBe('留下的')
  })

  it('顶替者被卸载后，被顶掉的那个回来', async () => {
    const ctx = await setup()
    await contribute(ctx, 'persona', 0, '原来的')
    const shadow = await contribute(ctx, 'persona', 0, '顶替的')

    expect(ctx.prompt.assemble()).toBe('顶替的')
    await shadow.dispose()
    expect(ctx.prompt.assemble()).toBe('原来的')
  })

  it('空段不贡献任何东西', async () => {
    const ctx = await setup()
    await contribute(ctx, 'a', 0, '有内容')
    await contribute(ctx, 'blank', 1, '   ')
    expect(ctx.prompt.assemble()).toBe('有内容')
  })

  it('text 是函数时，每次组装现算', async () => {
    const ctx = await setup()
    let n = 0
    await ctx.plugin({
      name: 'dynamic',
      inject: ['prompt'],
      apply(c: Context) {
        c.prompt.section({ name: 'dyn', order: 0, text: () => `第 ${String(++n)} 次` })
      },
    })
    expect(ctx.prompt.assemble()).toBe('第 1 次')
    expect(ctx.prompt.assemble()).toBe('第 2 次')
  })
})
