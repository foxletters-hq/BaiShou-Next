import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../ImagePreview.tsx'), 'utf8')

describe('ImagePreview chrome', () => {
  it('should offer save in the toolbar and context menu', () => {
    expect(src).toContain('savePreviewImage')
    expect(src).toContain("t('image_preview.save'")
    expect(src).toContain('Download')
    expect(src).toContain('downloadFileName')
  })

  it('should draw the toolbar save icon at the same stroke size as zoom controls', () => {
    const start = src.indexOf('onClick={() => void handleSaveImage()}')
    const saveBtn = src.slice(start, start + 700)
    expect(saveBtn).toContain('width="20"')
    expect(saveBtn).toContain('height="20"')
    expect(saveBtn).toContain('strokeWidth="2"')
    expect(saveBtn).not.toContain('<Download')
  })
})
