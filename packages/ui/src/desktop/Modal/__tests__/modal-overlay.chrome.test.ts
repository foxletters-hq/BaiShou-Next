import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))

function read(rel: string): string {
  return readFileSync(join(here, rel), 'utf8')
}

function overlayBlock(css: string, selector: string): string {
  const start = css.indexOf(`${selector} {`)
  expect(start).toBeGreaterThanOrEqual(0)
  const next = css.indexOf('\n}', start)
  return css.slice(start, next + 2)
}

describe('Modal overlay chrome', () => {
  it('should default to closing on overlay click', () => {
    const source = read('../Modal.tsx')
    expect(source).toContain('closeOnOverlayClick = true')
    expect(source).not.toContain('closeOnOverlayClick = false')
  })

  it('should dim the page with overlay color and not blur the background', () => {
    const overlay = overlayBlock(read('../Modal.module.css'), '.overlay')
    expect(overlay).toContain('background-color: var(--bg-overlay)')
    expect(overlay).toContain('backdrop-filter: none')
    expect(overlay).not.toMatch(/backdrop-filter:\s*(var\(--blur|blur\()/)
  })

  it('should let confirm dialogs inherit overlay dismiss from Modal', () => {
    const dialog = read('../../Dialog/index.tsx')
    expect(dialog).toContain('<Modal')
    expect(dialog).not.toContain('closeOnOverlayClick={false}')
  })

  it('should close standalone crop and provider dialogs when the overlay is pressed', () => {
    const crop = read('../../AvatarCropModal/index.tsx')
    const providers = read('../../AIModelServicesView/AIModelServicesModals.tsx')
    expect(crop).toContain('e.target === e.currentTarget')
    expect(crop).toContain('onCanceled()')
    expect(providers).toContain('setIsAddModalOpen(false)')
    expect(providers).toContain('setIsTestModalOpen(false)')
    expect(providers.match(/e\.target === e\.currentTarget/g)?.length).toBe(2)
  })
})
