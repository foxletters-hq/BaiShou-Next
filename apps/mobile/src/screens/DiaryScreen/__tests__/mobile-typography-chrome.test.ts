import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))

describe('mobile diary and settings chrome typography', () => {
  it('should take diary meta and the tab label from the shared mobile scale', () => {
    const status = readFileSync(join(here, '..', 'diary-screen.styles.ts'), 'utf8')
    const list = readFileSync(join(here, '..', 'components', 'DiaryList.tsx'), 'utf8')
    const tabs = readFileSync(join(here, '../../../../app/(tabs)/_layout.tsx'), 'utf8')
    expect(status).toContain('mobileTypography.secondary')
    expect(list).toContain('mobileTypography.secondary')
    expect(tabs).toContain('mobileTypography.caption')
  })

  it('should take settings titles and rows from the shared mobile scale', () => {
    const settings = readFileSync(join(here, '../../SettingsScreen/SettingsScreen.tsx'), 'utf8')
    const header = readFileSync(join(here, '../../../components/CompactTabHeader.tsx'), 'utf8')
    expect(settings).toContain('mobileTypography.secondary')
    expect(settings).toContain('mobileTypography.primary')
    expect(header).toContain('mobileTypography.title')
  })
})
