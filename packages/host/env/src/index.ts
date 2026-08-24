/**
 * ① 服务契约 —— 宿主环境。
 *
 * 插件不该自己读 process.env：
 *   · 会把同构包绑死在 Node 上
 *   · 依赖藏在函数体里，inject 那一行看不出来
 *   · 测不了（要改全局）、换不了（云端/浏览器换源就得改代码）
 *
 * 所以把「环境」定义成一块招牌，由装配层决定谁来挂。
 * 这个包零实现，和 @ctl/notify 一样只是一纸合同。
 */
import type { Context } from '@deepseek-ai/cordis'

/** 一个环境值，连同它的来源 */
export interface EnvValue {
  value: string
  /** 来自哪一层。'process' = 启动进程继承的，'static' = 配置里写死的 */
  source: string
}

export interface EnvService {
  /** 按名字取值，任何来源都接受 */
  get(name: string): EnvValue | undefined
  /**
   * 只接受来自指定层的值。
   *
   * 不列出某一层 = 明确拒绝它，而不是把它降级。
   * 将来层数变多、优先级调整，也不可能让不被信任的层偷偷混进来。
   */
  getFrom(name: string, sources: string[]): EnvValue | undefined
  /** 取不到就抛错，用于「缺了就不该启动」的必需项 */
  require(name: string): string
  /** 整张快照的副本，用于诊断输出 */
  snapshot(): Record<string, EnvValue>
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** 招牌名叫 env —— 消费方只认这个名字，不认背后是谁 */
    env: EnvService
  }
}
