import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))

function read(rel: string): string {
  return readFileSync(join(here, rel), 'utf8')
}

describe('diary sidebar brand icon', () => {
  it('should use the shared generated brand icon as the diary sidebar logo', () => {
    const sidebar = read('../index.tsx')
    expect(sidebar).toContain("import appIcon from '@baishou/shared/assets/images/icon.png'")
    expect(sidebar).toContain('ImagePreview')
    expect(sidebar).toContain('styles.brandLogo')
    expect(sidebar).toContain("downloadFileName={t('sidebar.brand_icon_filename'")
    expect(sidebar).toContain("t('sidebar.view_brand_icon'")
  })

  it('should point Windows installer and desktop app icons at the generated resource', () => {
    const builder = read('../../../../../../electron-builder.yml')
    const setup = read('../../../../../../setup.iss')
    const main = read('../../../../../../src/main/index.ts')
    expect(builder).toContain('icon: resources/icon.png')
    expect(setup).toContain('SetupIconPath')
    expect(setup).toContain('icon.ico')
    expect(main).toContain("from '../../resources/icon.png?asset'")
  })
})
