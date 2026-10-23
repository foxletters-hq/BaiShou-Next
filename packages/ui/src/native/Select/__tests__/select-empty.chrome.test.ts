import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'Select.tsx'), 'utf8')

describe('native Select empty options', () => {
  it('should show an empty copy in the picker when there are no options', () => {
    expect(src).toContain("t('common.no_data', '暂无资料'")
    expect(src).toContain('options.length === 0')
    expect(src).toContain('ListEmptyComponent')
  })

  it('should right-align the selected value on settings selectors', () => {
    expect(src).toContain("textAlign: isSettings ? 'right' : 'left'")
  })

  it('should fade centered and settings pickers without scaling', () => {
    expect(src).toContain("animationType={isCenter ? 'fade' : 'none'}")
    expect(src).not.toContain('scaleAnim')
    expect(src).not.toContain('panelOpacity')
    expect(src).not.toContain('transform: [{ scale')
  })
})
