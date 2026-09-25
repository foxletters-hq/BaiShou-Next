import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { LATTE_CHIBI_IMAGE_PATH } from '../latte-default-assistant.constants'

describe('latte shared assets', () => {
  it('should keep the chibi portrait in shared images for desktop and mobile', () => {
    expect(LATTE_CHIBI_IMAGE_PATH).toBe('assets/images/latte-chibi.png')
    const file = join(
      dirname(fileURLToPath(import.meta.url)),
      '../../../assets/images/latte-chibi.png'
    )
    expect(existsSync(file)).toBe(true)
    const bytes = readFileSync(file)
    expect(bytes.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    // IHDR 颜色类型 6 = RGBA，避免再被存成不带透明通道的 JPEG
    expect(bytes[25]).toBe(6)
  })
})
