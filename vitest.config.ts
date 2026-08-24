/**
 * 测试配置 —— 全仓库只有这一份，故意的。
 *
 * 对照 harness 的实测数据：238 个包，238 份 tsconfig，**0 份 vitest 配置**。
 *
 * 为什么这样分：
 *   tsconfig  每包一份 —— 编译单元 = 包边界 = 发布边界，
 *             每个包必须能脱离仓库单独编译
 *   vitest    只要一份 —— 测试是【横切】的：一次跑遍所有包，
 *             共用同一套 setup 和覆盖率报告。给每个包一份只会制造要同步的噪音
 */
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // 测试文件放在各自被测对象旁边，而不是集中到一个 tests/ 目录 ——
    // 改代码时测试就在眼前，不容易忘
    include: ['**/*.spec.ts'],
    exclude: ['**/node_modules/**', '**/lib/**', '**/dist/**'],
    // 门禁测试要在临时目录里造假仓库，用 node 环境
    environment: 'node',
  },
})
