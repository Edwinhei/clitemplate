/**
 * 门禁：宿主用 dependency，插件用 peer。
 *
 * 守的约束：框架本体必须全场唯一。
 * 能力包如果把 cordis 写成 dependency，发布出去之后消费者装了别的版本，
 * 就会出现两份实体 —— instanceof 当场翻车，而且【完全静默】。
 *
 * 顺带检查 peer 必须有同名 devDependency：
 * peer 不会被安装，只写 peer 的话你在自己包里跑 tsc 会找不到类型。
 */
import { join } from 'node:path'
import { type Gate, listPackages, type Violation } from './lib/workspace.ts'

/** 必须全场唯一的包 —— 它们做 instanceof 身份判断 */
const SINGLETON = ['@deepseek-ai/cordis']

export const gate: Gate = {
  name: 'dependency-layering',
  guards: '宿主用 dependency，插件用 peer；peer 必须配一份 dev',
  run(root) {
    const v: Violation[] = []
    for (const pkg of listPackages(root)) {
      const m = pkg.manifest
      const file = join(pkg.dir, 'package.json')
      const deps = m.dependencies ?? {}
      const peers = m.peerDependencies ?? {}
      const devs = m.devDependencies ?? {}

      for (const name of SINGLETON) {
        if (pkg.kind === 'package' && name in deps) {
          v.push({
            file,
            message: `能力包把 ${name} 写成了 dependency`,
            fix: '改成 peerDependencies + devDependencies 各一份。前者对消费者说「用你那份」，后者让自己能编译',
          })
        }
        if (pkg.kind === 'app' && name in peers) {
          v.push({
            file,
            message: `app 把 ${name} 写成了 peer`,
            fix: 'app 是宿主，它就是那个真的负责装的人。改成 dependencies',
          })
        }
      }

      for (const name of Object.keys(peers)) {
        if (!(name in devs)) {
          v.push({
            file,
            message: `${name} 是 peer 但没有同名 devDependency`,
            fix: 'peer 不会被安装。只写 peer 的话，你在自己包目录里跑 tsc 会找不到它',
          })
        }
      }
    }
    return v
  },
}
