import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const src = readFileSync(join(here, '../SettingsExpansionTile.tsx'), 'utf8')

describe('native SettingsExpansionTile chrome', () => {
  it('should allow unmounting collapsed body so it cannot cover the header', () => {
    expect(src).toContain('keepMounted')
    expect(src).toContain('keepMounted || open ? bodyInner : null')
  })
})
