/**
 * 门禁：包的形态必须和它在依赖图里的位置一致。
 *
 * 守的约束：
 *   · exports 是【库】的属性，bin 是【应用】的属性
 *   · exports 是白名单，不写 "./package.json" 就读不到它
 *   · 每个包都要有 description（227 包规模下这一行是唯一能救你的东西）
 *   · 每个包都要能被 pnpm -r run typecheck 覆盖到
 */
import { join } from 'node:path'
import { type Gate, listPackages, type Violation } from './lib/workspace.ts'

export const gate: Gate = {
  name: 'package-invariants',
  guards: '包的形态与它在依赖图里的位置一致',
  run(root) {
    const v: Violation[] = []
    for (const pkg of listPackages(root)) {
      const m = pkg.manifest
      const file = join(pkg.dir, 'package.json')

      if (!m.description) {
        v.push({
          file,
          message: '缺 description',
          fix: '写一句话说清它在系统里占什么位置，不要写「XX 模块」',
        })
      }
      if (!m.scripts?.typecheck) {
        v.push({
          file,
          message: '缺 typecheck 脚本',
          fix: '"scripts": { "typecheck": "tsc --noEmit" }',
        })
      }

      if (pkg.kind === 'package') {
        if (!m.exports) {
          v.push({
            file,
            message: '能力包缺 exports',
            fix: '"exports": { ".": "./src/index.ts", "./package.json": "./package.json" }',
          })
        } else if (!('./package.json' in m.exports)) {
          v.push({
            file,
            message: 'exports 里没有 "./package.json"',
            fix: 'exports 是白名单，没登记的路径一律 ERR_PACKAGE_PATH_NOT_EXPORTED —— 包括 package.json 自己',
          })
        }
        if (m.bin) {
          v.push({
            file,
            message: '能力包不该有 bin',
            fix: 'bin 是应用的属性。有 bin 说明它其实是个 app，该放进 apps/',
          })
        }
      }

      if (pkg.kind === 'app' && m.exports) {
        v.push({
          file,
          message: 'app 不该有 exports',
          fix: 'app 处在依赖图顶端，没有人 import 它。它靠 bin 交付，不靠被导入',
        })
      }
    }
    return v
  },
}
