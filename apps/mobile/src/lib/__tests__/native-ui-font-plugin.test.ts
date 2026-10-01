import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const plugin = require('../../../plugins/withNativeUiFonts.js') as {
  (config: unknown): unknown
  buildNativeUiFontConfig: () => {
    ios: { fonts: string[] }
    android: {
      fonts: Array<{
        fontFamily: string
        fontDefinitions: Array<{ path: string; weight: number }>
      }>
    }
  }
}
const { buildNativeUiFontConfig } = plugin

describe('native ui font config plugin', () => {
  it('should export a callable config plugin', () => {
    expect(typeof plugin).toBe('function')
  })

  it('should register source-han families with 400 500 600 files that exist', () => {
    const config = buildNativeUiFontConfig()
    expect(config.android.fonts.map((family) => family.fontFamily)).toEqual([
      'Noto Sans SC',
      'Noto Sans TC',
      'Noto Sans JP',
      'Noto Sans'
    ])
    for (const family of config.android.fonts) {
      expect(family.fontDefinitions.map((item) => item.weight)).toEqual([400, 500, 600])
      for (const definition of family.fontDefinitions) {
        expect(existsSync(definition.path)).toBe(true)
      }
    }
    expect(config.ios.fonts).toHaveLength(12)
    expect(config.ios.fonts.every((file) => existsSync(file))).toBe(true)
  })
})
