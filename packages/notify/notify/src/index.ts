/**
 * ① 服务定义（契约）
 *
 * 这个包【只有类型和声明】，零实现。
 * 提供方和消费方都只依赖它，彼此互不认识 —— 这是可替换性的全部基础。
 */
import type { Context } from '@deepseek-ai/cordis'

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

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** 招牌名叫 notify —— 消费方只认这个名字，不认背后是谁 */
    notify: NotifyService
  }
}

// 契约包本身不是插件，不需要 apply。
// 消费方用 `import type {} from '@ctl/notify'` 引入这份声明合并。
