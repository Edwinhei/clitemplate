#!/usr/bin/env node
/**
 * ctl —— 命令行入口。
 *
 * 从这一步开始，bin.ts 不再决定「程序做什么」——
 * 它只负责把 Cordis 启动起来，剩下的交给 cordis.yml。
 */
import { resolve } from 'node:path'
import { boot } from './boot.ts'

const argv = process.argv.slice(2)

if (argv[0] === '--help' || argv[0] === '-h') {
  console.log(`用法: ctl [参数...]

  一个可成长的 Cordis CLI 模板。
  实际行为由 cordis.yml 决定。`)
  process.exit(0)
}

// 允许用环境变量换一份清单 —— 「同一个程序，不同组合」的第一步
const configPath = resolve(process.env.CTL_CONFIG ?? 'cordis.yml')

try {
  await boot(configPath)
} catch (error) {
  console.error(error)
  process.exit(1)
}
