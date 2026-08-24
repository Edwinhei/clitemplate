/**
 * ① 服务定义（契约）
 *
 * 这个包【只有类型和声明】，零实现。
 * 提供方和消费方都只依赖它，彼此互不认识 —— 这是可替换性的全部基础。
 */

// ⚠️ 这一行不能删。
// 底下的 `declare module '@deepseek-ai/cordis'` 是【模块增强】，
// TypeScript 要求本文件先引用过那个模块，否则报
//   TS2664: Invalid module name in augmentation, module ... cannot be found
// 空的 `{}` 就够了 —— 我们只是要建立引用关系，不需要任何具体的名字。
//
// lint 工具会把它当成「未使用的导入」（Biome / ESLint / oxlint 三家都会）。
// 别信 —— 只有 tsc 说了算。
import type {} from '@deepseek-ai/cordis'

/** 一条通知 */
export interface Notification {
  /** 发给谁（收件人、频道、文件名……由具体实现解释） */
  to: string
  title: string
  body?: string
}

/** 契约：任何 notify 提供方都要实现这个形状 */
export interface NotifyService {
  send(msg: Notification): Promise<void>
}

/**
 * 调用方可以为自己申请的「待遇」。
 *
 * ⚠️ 这不是 Config —— 两者容易混，差别是根本性的：
 *
 *   Config      给【提供方】的。写在 cordis.yml 的 `config:` 里，
 *               决定「这块招牌怎么开」（往哪个文件写、什么格式）。
 *               一块招牌一份。
 *
 *   Intercept   给【调用方】的。写在 cordis.yml 的 `intercept:` 里，
 *               决定「我这个顾客享受什么待遇」。
 *               **同一块招牌，每个调用方一份，而且可以叠。**
 *
 * 用它而不是用 isolate，是因为这里要的不是「另一份东西」，
 * 是「同一份东西的另一种待遇」—— 两个调用方共用同一个文件句柄，
 * 隔离了就变成两个句柄、两份缓冲，纯浪费。
 */
export interface NotifyIntercept {
  /** 投递失败时吞掉异常（默认 false —— 失败就抛，让审计能发现） */
  silent?: boolean
  /** 给这个调用方的所有消息加个前缀，便于在日志里分辨来源 */
  prefix?: string
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** 招牌名叫 notify —— 消费方只认这个名字，不认背后是谁 */
    notify: NotifyService
  }

  /**
   * 把待遇声明进 Intercept —— 这样在 cordis.yml 里写
   * `intercept: { notify: { … } }` 时才有类型检查。
   */
  interface Intercept {
    notify: NotifyIntercept
  }

  /**
   * 契约的第二半：事件。
   *
   * 服务解决的是「我要用一个能力」，事件解决的是
   * 「一件事发生了，可能有人关心，但我不该知道是谁」。
   *
   * 提供方发通知这件事，可能有人想统计、想审计、想在安静时段拦下来 ——
   * 而 notify-console 不该认识这些插件里的任何一个。
   *
   * ⚠️ 这是【提供方的义务】：实现 NotifyService 的包，
   *    必须在实际投递前后触发这两个事件，否则策略层和统计层就失效了。
   */
  interface Events {
    /**
     * 投递之前问一声，任何一个监听器返回 true 就取消本次投递。
     *
     * 用 bail 派发：挨个问，谁先给出非空结果就用谁的，后面的不再问。
     * @param msg — 即将投递的通知
     * @returns true = 拦下；返回 undefined / 不返回 = 放行
     */
    'notify/before-send'(msg: Notification): boolean | undefined
    /**
     * 投递完成后广播一声。
     *
     * 用 emit 派发：喊完就走，不等任何人，也不关心有没有人听。
     * @param msg — 已经投递出去的通知
     */
    'notify/sent'(msg: Notification): void
  }
}
