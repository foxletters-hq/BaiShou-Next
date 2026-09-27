import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const desktop = readFileSync(join(here, '../builtin-assistant-avatar.sources.ts'), 'utf8')
const native = readFileSync(
  join(here, '../../native/builtin-assistant-avatar.sources.ts'),
  'utf8'
)

describe('builtin assistant avatar sources', () => {
  it('should register the blue-sky Latte portrait on desktop and native', () => {
    expect(desktop).toContain('assistant-preset-6')
    expect(native).toContain('assistant-preset-6')
    expect(desktop).toContain('assistant-presets/assistant-preset-6.jpg')
    expect(native).toContain('assistant-presets/assistant-preset-6.jpg')
  })
})
