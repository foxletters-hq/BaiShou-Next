import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const src = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'FloatingModal.tsx'),
  'utf8'
)

describe('native FloatingModal animation chrome', () => {
  it('should allow callers to skip the default fade', () => {
    expect(src).toContain("animationType?: 'none' | 'fade' | 'slide'")
    expect(src).toContain("animationType = 'fade'")
    expect(src).toContain('animationType={animationType}')
  })

  it('should cover the system navigation bar so the overlay has no bottom gap', () => {
    expect(src).toContain('statusBarTranslucent')
    expect(src).toContain('navigationBarTranslucent')
    expect(src).toContain('presentationStyle="overFullScreen"')
    expect(src).toContain("Dimensions.get('screen').height")
  })
})
