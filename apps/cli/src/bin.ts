#!/usr/bin/env node
/**
 * ctl —— 命令行入口。
 *
 * 这一步【故意还没有 Cordis】：
 * monorepo 里最容易翻车的不是框架，是包之间的引用。
 * 先确认「一个 workspace 包能被正确解析和执行」，下一步再接框架。
 */

const argv = process.argv.slice(2)

if (argv[0] === '--help' || argv[0] === '-h') {
  console.log(`用法: ctl [参数...]

  一个可成长的 Cordis CLI 模板。
  当前进度：步骤 1（还没接入 Cordis）`)
  process.exit(0)
}

console.log('ctl 启动了')
console.log('收到参数:', argv.length ? argv : '(无)')
