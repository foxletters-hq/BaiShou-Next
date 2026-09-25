import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))

function read(rel: string): string {
  return readFileSync(join(here, '..', rel), 'utf8')
}

describe('AssistantPickerSheet chrome', () => {
  it('closes when the overlay is pointer-down or Escape is pressed', () => {
    const source = read('AssistantPickerSheet.tsx')
    expect(source).toContain('onPointerDown={handleOverlayPointerDown}')
    expect(source).toContain('e.target !== e.currentTarget')
    expect(source).toContain("e.key === 'Escape'")
    expect(source).toContain('onClose()')
  })

  it('clips the overlay to the content card and uses form-field editors', () => {
    const css = read('AssistantPickerSheet.module.css')
    expect(css).toContain('var(--app-titlebar-height')
    expect(css).not.toContain('top: 48px')
    expect(css).not.toContain('rgba(255, 255, 255')
    expect(css).not.toContain("[data-theme='dark']")
    expect(read('AssistantPickerPromptTab.tsx').match(/variant="formField"/g)?.length).toBe(2)
  })
})
