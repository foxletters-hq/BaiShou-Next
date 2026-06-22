import { describe, it, expect, vi } from 'vitest'
import { DiaryCmAttachmentUrlCache } from '../diary-cm-attachment-url-cache'

describe('DiaryCmAttachmentUrlCache', () => {
  it('deduplicates concurrent resolves for the same srcRaw', async () => {
    const cache = new DiaryCmAttachmentUrlCache()
    let resolveCount = 0
    const resolver = vi.fn(async () => {
      resolveCount += 1
      await new Promise((r) => setTimeout(r, 10))
      return 'data:image/png;base64,abc'
    })

    const [a, b] = await Promise.all([
      cache.resolve('attachment/a.png', resolver),
      cache.resolve('attachment/a.png', resolver)
    ])

    expect(a).toBe('data:image/png;base64,abc')
    expect(b).toBe('data:image/png;base64,abc')
    expect(resolveCount).toBe(1)
    expect(resolver).toHaveBeenCalledTimes(1)
  })

  it('returns cached url without calling resolver again', async () => {
    const cache = new DiaryCmAttachmentUrlCache()
    const resolver = vi.fn(async () => 'data:image/jpeg;base64,xyz')

    await cache.resolve('attachment/b.jpg', resolver)
    const second = await cache.resolve('attachment/b.jpg', resolver)

    expect(second).toBe('data:image/jpeg;base64,xyz')
    expect(resolver).toHaveBeenCalledTimes(1)
  })

  it('evicts oldest entries when maxSize exceeded', async () => {
    const cache = new DiaryCmAttachmentUrlCache({ maxSize: 2 })
    const resolver = vi.fn(async (src: string) => `uri:${src}`)

    await cache.resolve('attachment/1.png', resolver)
    await cache.resolve('attachment/2.png', resolver)
    await cache.resolve('attachment/3.png', resolver)

    expect(cache.get('attachment/1.png')).toBeUndefined()
    expect(cache.get('attachment/2.png')).toBe('uri:attachment/2.png')
    expect(cache.get('attachment/3.png')).toBe('uri:attachment/3.png')
  })
})
