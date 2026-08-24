/**
 * ② 提供方 —— section 注册表。
 *
 * 它和前面那些提供方（notify-console 之类）有个结构上的差别：
 * **别人不只是「调用」它，还会「往它里面放东西」。**
 * 所以它需要处理一件新问题：放东西的那个插件被卸载时，东西要跟着消失。
 */

import type { PromptSection, PromptService } from '@ctl/prompt'
import { type Context, Service } from '@deepseek-ai/cordis'

class PromptRegistry extends Service implements PromptService {
  /** 槽位名 → 内容。用 Map 而不是数组，因为「同名即替换」正好是 Map 的语义 */
  private sections = new Map<string, PromptSection>()

  constructor(ctx: Context) {
    super(ctx, 'prompt')
  }

  section(section: PromptSection): void {
    // ★ 这里的 this.ctx 是【调用方的】ctx，不是注册表自己的。
    //
    //   Service 基类在构造时装了一个 tracker（07 篇「包装里装的是我是谁」）：
    //   别人通过 ctx.prompt 拿到的是一个代理，代理的 .ctx 指向【他自己】。
    //   实测：服务方法里 this.ctx.fiber.name === 调用方插件名。
    //
    //   所以这笔 effect 记在贡献方的账上 —— 贡献方被卸载，它那段自动消失。
    this.ctx.effect(() => {
      const previous = this.sections.get(section.name)
      this.sections.set(section.name, section)

      return () => {
        // 只有当前占位的还是我，才撤销 —— 否则会把后来顶替我的那个人误删
        if (this.sections.get(section.name) !== section) return
        if (previous) this.sections.set(section.name, previous)
        else this.sections.delete(section.name)
      }
    })
  }

  assemble(): string {
    return [...this.sections.values()]
      .sort((a, b) => a.order - b.order)
      .map((s) => (typeof s.text === 'function' ? s.text() : s.text))
      .filter((t) => t.trim().length > 0) // 空段不贡献任何东西
      .join('\n\n')
  }

  list(): { name: string; order: number }[] {
    return [...this.sections.values()]
      .sort((a, b) => a.order - b.order)
      .map(({ name, order }) => ({ name, order }))
  }
}

export const name = 'prompt-registry'

export function apply(ctx: Context): void {
  ctx.plugin(PromptRegistry)
}
