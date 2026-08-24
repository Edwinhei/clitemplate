/**
 * 定时任务 —— 模板里第一个【持有真实句柄】的插件。
 *
 * 前面所有插件都是无状态的：挂个招牌、发条日志、写个文件，做完就没事了。
 * 这个不一样，它要持有一个 interval —— 而 interval 是会把进程钉住的东西。
 *
 * 所以它同时演示两件事：
 *   ① ctx.effect ——「当场交复原单」，卸载时框架负责执行，你不用记得关
 *   ② isolate    —— 多个实例各自拿到【同名但不同实体】的服务
 */

import type {} from '@ctl/notify'
import type { Context } from '@deepseek-ai/cordis'
import Schema from '@deepseek-ai/schemastery'

export interface Config {
  /** 心跳间隔（毫秒） */
  intervalMs: number
  /** 跳几次之后自己收摊。写 0 表示永不停 —— 那样进程也不会退出 */
  times: number
  /** 通知标题 */
  label: string
}

export const Config: Schema<Config> = Schema.object({
  intervalMs: Schema.number().default(300).description('心跳间隔（毫秒）'),
  times: Schema.number().default(3).description('跳几次后自己收摊；0 = 永不停'),
  label: Schema.string().default('心跳').description('通知标题'),
})

export const name = 'task-heartbeat'

/** 它要用 notify 招牌 —— 而用到的是哪一块，取决于自己在哪个隔离分区里 */
export const inject = ['notify']

export function apply(ctx: Context, config: Config): void {
  const log = ctx.logger('task-heartbeat')
  let beat = 0

  // ★ ctx.effect：开资源的同一处，当场把「怎么关」交出去。
  //
  //   为什么不能写成 `return () => clearInterval(timer)` 直接从 apply 返回？
  //   因为 `export function apply` 是 function 声明，有 prototype，
  //   Cordis 会把它当构造函数 `new` 出来 —— 返回值在那一步就被丢弃了，
  //   而且【完全静默】。详见 05 篇实战。
  //
  //   effect 的返回值是一张可以主动调用的复原单，下面收摊时会用到。
  const stop = ctx.effect(() => {
    const timer = setInterval(() => {
      beat += 1
      // 消费方不知道 notify 背后是谁，也不知道自己在哪个分区里 ——
      // 这两件事都由装配层决定
      void ctx.notify.send({ to: config.label, title: `${config.label} #${String(beat)}` })

      if (config.times > 0 && beat >= config.times) {
        log.info('%s 跳满 %d 次，自己收摊', config.label, config.times)
        stop() // ← 主动执行复原单：interval 被清掉，句柄归还
      }
    }, config.intervalMs)

    log.info('%s 启动，每 %dms 一次', config.label, config.intervalMs)

    // 这张单子会被记进本插件的档案。不管是谁发起的卸载
    // （热重载 / 上面那次主动调用 / 整棵树销毁），它都会被执行。
    return () => {
      clearInterval(timer)
      log.info('%s 的复原单执行了 —— interval 已清除', config.label)
    }
  })
}
