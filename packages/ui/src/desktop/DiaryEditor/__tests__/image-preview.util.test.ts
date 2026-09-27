import { afterEach, describe, expect, it, vi } from 'vitest'
import { inferImagePreviewDownloadName, savePreviewImage } from '../image-preview.util'

describe('inferImagePreviewDownloadName', () => {
  it('should prefer an explicit file name when given', () => {
    expect(
      inferImagePreviewDownloadName('https://example.com/a.png', { fileName: '白守.png' })
    ).toBe('白守.png')
  })

  it('should take the image leaf from src when no explicit name is given', () => {
    expect(inferImagePreviewDownloadName('app://./assets/icon.png?hash=1')).toBe('icon.png')
  })

  it('should fall back to alt.png when src has no image extension', () => {
    expect(inferImagePreviewDownloadName('blob:abc', { alt: 'BaiShou' })).toBe('BaiShou.png')
  })
})

describe('savePreviewImage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('should write through showSaveFilePicker when the picker is available', async () => {
    const write = vi.fn().mockResolvedValue(undefined)
    const close = vi.fn().mockResolvedValue(undefined)
    const picker = vi.fn().mockResolvedValue({
      createWritable: () => Promise.resolve({ write, close })
    })
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, blob: () => Promise.resolve(new Blob(['png'])) })
    )
    vi.stubGlobal('showSaveFilePicker', picker)

    const result = await savePreviewImage('https://example.com/icon.png', { fileName: '白守.png' })

    expect(result).toEqual({ success: true })
    expect(picker).toHaveBeenCalledWith(
      expect.objectContaining({ suggestedName: '白守.png' })
    )
    expect(write).toHaveBeenCalled()
    expect(close).toHaveBeenCalled()
  })

  it('should treat picker abort as a canceled save', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, blob: () => Promise.resolve(new Blob(['png'])) })
    )
    vi.stubGlobal(
      'showSaveFilePicker',
      vi.fn().mockRejectedValue(new DOMException('The user aborted a request.', 'AbortError'))
    )

    await expect(savePreviewImage('https://example.com/icon.png')).resolves.toEqual({
      success: true,
      canceled: true
    })
  })

  it('should fall back to an anchor download when no picker exists', async () => {
    vi.stubGlobal('showSaveFilePicker', undefined)
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, blob: () => Promise.resolve(new Blob(['png'])) })
    )
    const click = vi.fn()
    const remove = vi.fn()
    const originalCreate = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'a') {
        return { href: '', download: '', click, remove } as unknown as HTMLAnchorElement
      }
      return originalCreate(tag)
    })
    vi.spyOn(document.body, 'appendChild').mockImplementation((node) => node)

    const result = await savePreviewImage('https://example.com/icon.png', { fileName: '白守.png' })

    expect(result).toEqual({ success: true })
    expect(click).toHaveBeenCalled()
  })
})
