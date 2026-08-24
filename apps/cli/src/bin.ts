import { resolve, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { boot } from './boot.ts'
import type { PatchOptions } from '@deepseek-ai/cordis-plugin-include'
import { dumpConfig, loadProfilePatches } from './profile.ts'

const argv = process.argv.slice(2)

if (argv.includes('--help') || argv.includes('-h')) {
  console.log(`用法: ctl [参数...]

  一个可成长的 Cordis CLI 模板。实际行为由 cordis.yml 决定。

参数
  --dump-config     打印最终会挂载的条目列表，然后退出（不启动任何插件）
  -h, --help        显示本帮助

环境变量（只认 shell / CI 层，写进 .env 无效）
  CTL_CONFIG        整份换掉配置文件路径
  CTL_PROFILE       叠加 patches/<name>.yml
  CTL_LOG_FILE      同时把结构化日志写进这个文件
  CTL_WATCH=1       热重载模式（进程不会自己退出）`)
  process.exit(0)
}

// 默认用【本包自带】的组合，而不是当前工作目录 ——
// 否则你在别的目录敲 ctl，它会去那个目录找 cordis.yml
const DEFAULT_CONFIG = resolve(dirname(fileURLToPath(import.meta.url)), '../cordis.yml')

// 环境变量可以整份换掉 —— 「同一个程序，不同组合」的最简形式
const configPath = resolve(process.env.CTL_CONFIG ?? DEFAULT_CONFIG)
const baseUrl = pathToFileURL(dirname(configPath)).href + '/'

// profile 是【引导期的事实】，和 CTL_LOG_FILE / CTL_WATCH 同一层：
// 只认 shell / CI 传进来的，不接受 .env —— 否则一个提交进版本库的文件
// 就能悄悄改变整个应用的组合。
const profile = process.env.CTL_PROFILE
let patches: PatchOptions[] = []
if (profile) {
  try {
    patches = loadProfilePatches(baseUrl, profile)
  } catch (error) {
    // 拼错 profile 名是常见手误，给一句人话而不是一坨堆栈
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  }
}

// --dump-config 走的是和真正启动【同一个】applyEntryPatches，
// 所以它打印的东西不可能和实际挂载的脱节。
if (argv.includes('--dump-config')) {
  try {
    process.stdout.write(dumpConfig(configPath, patches))
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  }
  process.exit(0)
}

try {
  await boot(configPath, patches)
} catch (error) {
  console.error(error)
  process.exit(1)
}
