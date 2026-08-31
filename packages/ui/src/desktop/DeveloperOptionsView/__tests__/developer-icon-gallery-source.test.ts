import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../index.tsx'), 'utf8')

describe('DeveloperOptionsView icon gallery entry', () => {
  it('opens the icon gallery from the developer menu', () => {
    expect(src).toContain("import('./DeveloperIconGallery')")
    expect(src).toContain("setPage('icons')")
    expect(src).toContain("t('developer.icon_gallery'")
  })
})
