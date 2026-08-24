/**
 * 门禁自己的测试。
 *
 * ═══════════════════════════════════════════════════════════════
 * 为什么门禁必须有测试
 * ═══════════════════════════════════════════════════════════════
 *
 * **一道从不失败的门禁等于没有。**
 *
 * 而门禁失效是【静默】的：它照样输出 ✅，你照样以为它在保护你 ——
 * 直到某天一个本该被拦下的改动进了主干。
 *
 * 所以每道门禁都要有两类测试：
 *   ① 合规的仓库 → 必须放行（否则它会逼人绕过去）
 *   ② 违规的仓库 → 必须抓到，而且报错要指向【正确的文件】
 *
 * 加新门禁时，这两条一起加。
 */

import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import { type Files, makeRepo, VALID_WORKSPACE, validManifest } from './lib/fixture.ts'
import { gate as catalog } from './verify-catalog.ts'
import { gate as dependencyLayering } from './verify-dependency-layering.ts'
import { gate as effectCleanup } from './verify-effect-cleanup.ts'
import { gate as envAccess } from './verify-env-access.ts'
import { gate as packageInvariants } from './verify-package-invariants.ts'
import { gate as runtimeClosure } from './verify-runtime-closure.ts'

const REPO_ROOT = resolve(fileURLToPath(import.meta.url), '../..')

/** 一份合规的最小仓库：一个 app + 一个能力包 */
function cleanFiles(): Files {
  return {
    'pnpm-workspace.yaml': VALID_WORKSPACE,
    'apps/cli/package.json': validManifest('@ctl/cli', 'app'),
    'apps/cli/cordis.yml': "- id: hello\n  name: './src/plugins/hello.ts'\n",
    'apps/cli/src/bin.ts': 'export const x = 1\n',
    'packages/host/env/package.json': validManifest('@ctl/env', 'package'),
    'packages/host/env/src/index.ts': 'export const y = 1\n',
  }
}

/** 造一个仓库，跑一道门禁，返回违规列表 */
function run(gate: { run(root: string): { file: string; message: string }[] }, patch: Files = {}) {
  const { root, cleanup } = makeRepo({ ...cleanFiles(), ...patch })
  try {
    return gate.run(root)
  } finally {
    cleanup()
  }
}

// ═══════════════════════════════════════════════════════════════
// ① 合规的仓库必须全部放行
// ═══════════════════════════════════════════════════════════════
describe('合规的仓库', () => {
  const gates = [
    packageInvariants,
    dependencyLayering,
    catalog,
    runtimeClosure,
    envAccess,
    effectCleanup,
  ]
  for (const gate of gates) {
    it(`${gate.name} 放行`, () => {
      expect(run(gate)).toEqual([])
    })
  }
})

// ═══════════════════════════════════════════════════════════════
// ② 每道门禁都要真的抓得到 —— 这才是这份测试存在的理由
// ═══════════════════════════════════════════════════════════════
describe('package-invariants', () => {
  it('抓到：能力包缺 description', () => {
    const m = validManifest('@ctl/env', 'package')
    delete m.description
    const v = run(packageInvariants, { 'packages/host/env/package.json': m })
    expect(v).toHaveLength(1)
    expect(v[0]?.message).toContain('description')
    expect(v[0]?.file).toBe('packages/host/env/package.json')
  })

  it('抓到：exports 少了 "./package.json"', () => {
    const m = validManifest('@ctl/env', 'package')
    m.exports = { '.': './src/index.ts' }
    const v = run(packageInvariants, { 'packages/host/env/package.json': m })
    expect(v[0]?.message).toContain('./package.json')
  })

  it('抓到：app 长出了 exports', () => {
    const m = validManifest('@ctl/cli', 'app')
    m.exports = { '.': './src/bin.ts' }
    const v = run(packageInvariants, { 'apps/cli/package.json': m })
    expect(v[0]?.message).toContain('app 不该有 exports')
  })

  it('抓到：能力包长出了 bin', () => {
    const m = validManifest('@ctl/env', 'package')
    m.bin = { foo: './src/index.ts' }
    const v = run(packageInvariants, { 'packages/host/env/package.json': m })
    expect(v.some((x) => x.message.includes('不该有 bin'))).toBe(true)
  })
})

describe('dependency-layering', () => {
  it('抓到：能力包把 cordis 写成 dependency', () => {
    const m = validManifest('@ctl/env', 'package')
    m.dependencies = { '@deepseek-ai/cordis': 'catalog:' }
    const v = run(dependencyLayering, { 'packages/host/env/package.json': m })
    expect(v[0]?.message).toContain('dependency')
  })

  it('抓到：peer 没有配套的 devDependency', () => {
    const m = validManifest('@ctl/env', 'package')
    m.devDependencies = {}
    const v = run(dependencyLayering, { 'packages/host/env/package.json': m })
    expect(v[0]?.message).toContain('没有同名 devDependency')
  })
})

describe('catalog', () => {
  it('抓到：硬编码版本号', () => {
    const m = validManifest('@ctl/env', 'package')
    m.peerDependencies = { '@deepseek-ai/cordis': '^4.0.1' }
    m.devDependencies = { '@deepseek-ai/cordis': '^4.0.1' }
    const v = run(catalog, { 'packages/host/env/package.json': m })
    expect(v.every((x) => x.message.includes('硬版本'))).toBe(true)
  })

  it('放行：具名目录 —— 「只写一处」不等于「只准一个版本」', () => {
    const m = validManifest('@ctl/env', 'package')
    m.peerDependencies = { 'some-lib': 'catalog:legacy' }
    m.devDependencies = { 'some-lib': 'catalog:legacy' }
    const v = run(catalog, {
      'pnpm-workspace.yaml': `${VALID_WORKSPACE}\ncatalogs:\n  legacy:\n    some-lib: '^1.0.0'\n`,
      'packages/host/env/package.json': m,
    })
    expect(v).toEqual([])
  })

  it('抓到：引用了不存在的具名目录', () => {
    const m = validManifest('@ctl/env', 'package')
    m.peerDependencies = { 'some-lib': 'catalog:nope' }
    m.devDependencies = { 'some-lib': 'catalog:nope' }
    const v = run(catalog, { 'packages/host/env/package.json': m })
    expect(v.some((x) => x.message.includes('不存在的目录'))).toBe(true)
  })

  it('抓到：框架本体被放进具名目录', () => {
    const v = run(catalog, {
      'pnpm-workspace.yaml': `${VALID_WORKSPACE}\ncatalogs:\n  cli:\n    '@deepseek-ai/cordis': '3.9.0'\n`,
    })
    expect(v[0]?.message).toContain('必须全场唯一')
    expect(v[0]?.file).toBe('pnpm-workspace.yaml')
  })
})

describe('runtime-closure', () => {
  it('抓到：cordis.yml 引用了宿主没声明的包', () => {
    const v = run(runtimeClosure, {
      'apps/cli/cordis.yml': "- id: ghost\n  name: '@ctl/does-not-exist'\n",
    })
    expect(v[0]?.message).toContain('@ctl/does-not-exist')
    expect(v[0]?.file).toBe('apps/cli/cordis.yml')
  })

  it('抓到：patch 里引用未声明的包，且报错指向 patch 文件', () => {
    const v = run(runtimeClosure, {
      'apps/cli/patches/prod.yml': "- id: x\n  name: '@ctl/only-in-patch'\n",
    })
    expect(v[0]?.file).toBe('apps/cli/patches/prod.yml')
  })

  it('放行：相对路径不需要声明', () => {
    const v = run(runtimeClosure, {
      'apps/cli/cordis.yml': "- id: local\n  name: './src/plugins/x.ts'\n",
    })
    expect(v).toEqual([])
  })
})

describe('env-access', () => {
  it('抓到：插件里直接读 process.env，且精确到行号', () => {
    const v = run(envAccess, {
      'packages/host/env/src/index.ts':
        'export const a = 1\nconst b = process.env.FOO\nexport const c = b\n',
    })
    expect(v).toHaveLength(1)
    expect(v[0]?.file).toBe('packages/host/env/src/index.ts:2')
  })

  it('放行：注释里提到 process.env 不算', () => {
    const v = run(envAccess, {
      'packages/host/env/src/index.ts':
        '/** 依赖显形在这一行 —— 没有隐藏的 process.env */\n// 也不要写 process.env\nexport const a = 1\n',
    })
    expect(v).toEqual([])
  })
})

describe('effect-cleanup', () => {
  it('抓到：apply 里 return 一个函数', () => {
    const v = run(effectCleanup, {
      'packages/host/env/src/index.ts':
        'export function apply(ctx) {\n  const t = setInterval(() => {}, 1)\n  return () => clearInterval(t)\n}\n',
    })
    expect(v).toHaveLength(1)
    expect(v[0]?.file).toContain(':3')
  })

  it('放行：清理写在 ctx.effect 里', () => {
    const v = run(effectCleanup, {
      'packages/host/env/src/index.ts':
        'export function apply(ctx) {\n  ctx.effect(() => {\n    const t = setInterval(() => {}, 1)\n    return () => clearInterval(t)\n  })\n}\n',
    })
    expect(v).toEqual([])
  })
})

// ═══════════════════════════════════════════════════════════════
// ③ 回归：这个仓库自己必须全绿
// ═══════════════════════════════════════════════════════════════
describe('本仓库回归', () => {
  const gates = [
    packageInvariants,
    dependencyLayering,
    catalog,
    runtimeClosure,
    envAccess,
    effectCleanup,
  ]
  for (const gate of gates) {
    it(`${gate.name} 通过`, () => {
      expect(gate.run(REPO_ROOT)).toEqual([])
    })
  }
})
