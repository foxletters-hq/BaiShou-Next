import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { APP_BRAND_ICON_PATH, APP_BRAND_ICON_SOURCE_PATH } from '../app-brand.constants'

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const here = dirname(fileURLToPath(import.meta.url))
const sharedAssets = join(here, '../../../assets/images')
const repoRoot = join(here, '../../../../../')

describe('app brand icon assets', () => {
  it('should keep the source and generated icons as RGBA PNG', () => {
    expect(APP_BRAND_ICON_SOURCE_PATH).toBe('assets/images/app-brand-icon-source.png')
    expect(APP_BRAND_ICON_PATH).toBe('assets/images/icon.png')

    const source = join(sharedAssets, 'app-brand-icon-source.png')
    const generated = join(sharedAssets, 'icon.png')
    expect(existsSync(source)).toBe(true)
    expect(existsSync(generated)).toBe(true)

    for (const file of [source, generated]) {
      const bytes = readFileSync(file)
      expect(bytes.subarray(0, 8)).toEqual(PNG_SIG)
      expect(bytes[25]).toBe(6)
    }
  })

  it('should generate desktop, mobile and installer icons from the shared source', () => {
    const syncScript = readFileSync(join(repoRoot, 'scripts/sync-app-icon.mjs'), 'utf8')
    const generateScript = readFileSync(join(repoRoot, 'scripts/generate-app-icons.py'), 'utf8')
    expect(syncScript).toContain('packages/shared/assets/images/app-brand-icon-source.png')
    expect(syncScript).toContain('apps/desktop/resources/icon.png')
    expect(syncScript).toContain('apps/mobile/assets/images/icon.png')
    expect(generateScript).toContain('apps/desktop/resources/icon.png')
    expect(generateScript).toContain('apps/mobile/assets/images/icon.png')
  })
})
