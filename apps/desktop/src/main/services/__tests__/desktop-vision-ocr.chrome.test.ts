import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const src = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'register-desktop-vision-ocr.ts'),
  'utf8'
)

describe('desktop vision ocr chrome', () => {
  it('should send the page image as a normalized ImagePart instead of a data URL', () => {
    expect(src).toContain('buildVisionPageImagePart')
    expect(src).not.toContain('data:image/png;base64,${pngBase64}')
  })
})
