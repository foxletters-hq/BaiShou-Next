import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))

describe('mobile metro bundle chrome', () => {
  it('should register lucide deep-import before the reanimated plugin', () => {
    const babelConfig = readFileSync(join(here, '../../babel.config.js'), 'utf8')
    expect(babelConfig).toContain('./babel/lucide-native-deep-import.cjs')
    const lucideIndex = babelConfig.indexOf('lucide-native-deep-import')
    const reanimatedIndex = babelConfig.indexOf('react-native-reanimated/plugin')
    expect(lucideIndex).toBeGreaterThan(-1)
    expect(reanimatedIndex).toBeGreaterThan(lucideIndex)
  })

  it('should compute content-based SHA-1 for .worklets instead of performance.now()', () => {
    const metroPatch = readFileSync(join(here, '../../../../patches/metro@0.83.7.patch'), 'utf8')
    expect(metroPatch).not.toContain('performance.now()')
    expect(metroPatch).toContain('_fs.default.promises.readFile')
  })

  it('should preserve default blockList and exclude desktop/build directories in metro.config.js', () => {
    const metroConfig = readFileSync(join(here, '../../metro.config.js'), 'utf8')
    expect(metroConfig).toContain(
      'const defaultBlockList = Array.isArray(config.resolver.blockList)'
    )
    expect(metroConfig).toContain('...defaultBlockList')
    expect(metroConfig).toContain('packages/core-desktop')
    expect(metroConfig).toContain('packages/database-desktop')
    expect(metroConfig).toContain('@lobehub|@ant-design|antd')
  })
})
