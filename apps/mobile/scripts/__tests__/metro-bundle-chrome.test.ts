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
})
