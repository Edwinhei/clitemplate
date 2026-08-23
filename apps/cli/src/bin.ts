import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { boot } from './boot.ts'

const argv = process.argv.slice(2)

if (argv[0] === '--help' || argv[0] === '-h') {
  console.log(`用法: ctl [参数...]

  一个可成长的 Cordis CLI 模板。
  实际行为由 cordis.yml 决定。`)
  process.exit(0)
}

// 默认用【本包自带】的组合，而不是当前工作目录 ——
// 否则你在别的目录敲 ctl，它会去那个目录找 cordis.yml
const DEFAULT_CONFIG = resolve(dirname(fileURLToPath(import.meta.url)), '../cordis.yml')

// 环境变量可以整份换掉 —— 「同一个程序，不同组合」的最简形式
const configPath = resolve(process.env.CTL_CONFIG ?? DEFAULT_CONFIG)

try {
  await boot(configPath)
} catch (error) {
  console.error(error)
  process.exit(1)
}
