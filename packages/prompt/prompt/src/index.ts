/**
 * ① 服务契约 —— system prompt 的 section 注册表。
 *
 * 这条 seam 和前面几条【槽位语义不同】，值得单独看一眼：
 *
 *   notify seam   槽位 = 服务名。同名 → 撞车报错（07 篇「规矩一」）
 *                 因为「谁来发通知」全场只能有一个答案
 *
 *   prompt seam   槽位 = section 名。同名 → 【替换】
 *                 因为「人格是什么」应该允许被更专门的东西顶掉
 *
 * harness 的 system-prompt 就是这个形状，它的注释说得很清楚：
 *   "an agent preset shadows the deployment's persona with its own —
 *    and both sides naming the same section is what makes the replacement
 *    work rather than duplicate"
 *   （两边取同一个 section 名，才使得它成为「替换」而不是「重复」）
 */

// ⚠️ 这一行不能删。底下的 declare module 是【模块增强】，
//    TypeScript 要求本文件先引用过那个模块，否则报 TS2664。
//    lint 会说它没用 —— 别信，只有 tsc 说了算。
import type {} from '@deepseek-ai/cordis'

/** 一段 prompt */
export interface PromptSection {
  /** 槽位名。**同名即替换** —— 这是本条 seam 与 notify seam 最大的差别 */
  name: string
  /**
   * 拼接顺序，升序。约定（抄 harness）：
   *   -100  框架身份（「你是谁」「用什么语言回答」）
   *      0  部署人格（最常被 preset 顶掉的那一段）
   *   100+  工具指引
   */
  order: number
  /**
   * 静态文本，或每次组装时求值的函数。
   * 用函数是为了让内容能反映**组装那一刻**的状态（时间、可用工具、用户偏好）。
   */
  text: string | (() => string)
}

export interface PromptService {
  /**
   * 注册一段 prompt。
   *
   * 注册本身是一笔 effect —— **贡献方被卸载时，它那段自动消失**，
   * 不需要手写反注册。热重载时这一点尤其关键。
   */
  section(section: PromptSection): void
  /** 按 order 升序拼接成完整的 system prompt */
  assemble(): string
  /** 当前有哪些 section（诊断用） */
  list(): { name: string; order: number }[]
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** 招牌名叫 prompt */
    prompt: PromptService
  }
}
