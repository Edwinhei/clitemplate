/**
 * 启动审计 —— 治 Cordis 头号坑：插件静默停在 PENDING。
 *
 * Cordis 的 inject 语义是「等依赖到齐再启动」，所以服务缺失时
 * 它不报错，只是安静地等。但在 boot 结算之后，还在等的就是
 * 永远等不到了 —— 这时候必须把它变成一次响亮的启动失败。
 */
import type { Context, FiberState } from '@deepseek-ai/cordis'

/**
 * FiberState 是 const enum，在 erasableSyntaxOnly 下不能当值用，
 * 所以在这里做值镜像。数字必须和 cordis 的定义保持一致：
 * PENDING=0 / LOADING=1 / ACTIVE=2 / FAILED=3 / DISPOSED=4 / UNLOADING=5
 */
const FIBER_PENDING = 0 as FiberState.PENDING
const FIBER_ACTIVE = 2 as FiberState.ACTIVE
const FIBER_FAILED = 3 as FiberState.FAILED

/**
 * 在配置树结算之后巡场一遍，任何没能变成 ACTIVE 的条目都让启动失败。
 *
 * @param ctx     已完成 boot 的根 Context
 * @param binName 诊断前缀，出现在错误信息开头（我们这里是 'ctl'）
 * @throws 有条目没加载、没激活、或启动时抛错
 */
export async function assertEntriesActivated(ctx: Context, binName: string): Promise<void> {
  // ── 第一关：模块压根没加载 ──────────────────────────────
  // fiber 为 undefined 说明这条 entry 连执照都没办下来。
  // 被显式 disabled 的条目是唯一合法的「没有 fiber」状态。
  const unloaded = [...ctx.loader.entries()].filter(
    (entry) => entry.fiber === undefined && !entry.disabled,
  )
  if (unloaded.length > 0) {
    const names = unloaded.map((entry) => entry.options.name).join(', ')
    throw new Error(`${binName}: 插件加载失败：${names}`)
  }

  // ── 第二关：加载了，但没变成 ACTIVE ────────────────────
  const failures: string[] = []

  for (const entry of ctx.loader.entries()) {
    const fiber = entry.fiber
    if (fiber === undefined || entry.disabled) continue

    // 唯一正常的终态，跳过
    if (fiber.state === FIBER_ACTIVE) continue

    // 启动时抛了错：await 一下把它私藏的 reject 原因取出来
    if (fiber.state === FIBER_FAILED) {
      try {
        await fiber.await()
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error)
        failures.push(`  ${entry.options.name}\n    启动时抛错：${detail}`)
      }
      continue
    }

    // ★ 核心：还在等服务。算出「声明要什么」减去「现在拿得到什么」
    if (fiber.state === FIBER_PENDING) {
      const missing = Object.keys(fiber.inject).filter(
        (service) => fiber.ctx.get(service) === undefined,
      )
      failures.push(`  ${entry.options.name}\n    等待服务：${missing.join(', ') || '(未知)'}`)
      continue
    }

    // LOADING / UNLOADING / DISPOSED —— 结算后不该出现，兜底报出来
    failures.push(`  ${entry.options.name}\n    fiber 状态异常：${String(fiber.state)}`)
  }

  if (failures.length > 0) {
    throw new Error(`${binName}: ${failures.length} 个插件没能激活\n\n${failures.join('\n\n')}\n`)
  }
}
