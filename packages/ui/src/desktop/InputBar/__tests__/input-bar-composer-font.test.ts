import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const dir = dirname(fileURLToPath(import.meta.url))
const css = readFileSync(join(dir, '../InputBar.module.css'), 'utf8')

describe('InputBar composer font', () => {
  it('should use the dialogue size token on the wrap and inherit it for typed text and placeholder when composing', () => {
    expect(css).toMatch(/\.skillEditorWrap\s*\{[^}]*font-size:\s*var\(--ui-fs-lg\)/s)
    expect(css).toMatch(/\.skillEditor\s*\{[^}]*font-size:\s*inherit/s)
    expect(css).toMatch(/\.textarea\s*\{[^}]*font-size:\s*inherit/s)
    expect(css).toMatch(
      /\.skillEditorWrap\[data-empty='true'\]\s+\.skillEditor:empty::before\s*\{[^}]*font-size:\s*inherit/s
    )
    expect(css).toMatch(/\.textarea::placeholder\s*\{[^}]*font-size:\s*inherit/s)
  })
})
