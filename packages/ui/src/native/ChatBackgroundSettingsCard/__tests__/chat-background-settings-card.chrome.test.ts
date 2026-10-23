import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))

describe('native ChatBackgroundSettingsCard chrome', () => {
  it('should use a Modal popup instead of expanding inline with SettingsExpansionTile', () => {
    const src = readFileSync(join(here, '../ChatBackgroundSettingsCard.tsx'), 'utf8')
    expect(src).not.toContain('SettingsExpansionTile')
    expect(src).toContain('<Modal')
    expect(src).toContain('setModalOpen(true)')
    expect(src).toContain('settings.chat_background')
  })
})
