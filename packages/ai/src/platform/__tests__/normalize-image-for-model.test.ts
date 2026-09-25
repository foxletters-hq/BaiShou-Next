import { afterEach, describe, expect, it, vi } from 'vitest'
import { clearImageCompressor } from '../image-compressor.registry'
import { normalizeImageForModel } from '../normalize-image-for-model'

afterEach(() => {
  clearImageCompressor()
  vi.unstubAllGlobals()
  vi.resetModules()
})

describe('normalizeImageForModel', () => {
  it('should keep small inline png as bare base64', async () => {
    const result = await normalizeImageForModel({
      data: 'data:image/png;base64,ZmFrZQ==',
      mimeType: 'image/png',
      fileName: 'page.png'
    })

    expect(result).toEqual({ base64: 'ZmFrZQ==', mimeType: 'image/png' })
  })

  it('should jpeg-compress an in-memory page when electron can read the buffer', async () => {
    const jpeg = Buffer.from('jpeg-bytes')
    vi.stubGlobal('process', {
      ...process,
      versions: { ...process.versions, electron: '38.0.0' }
    })
    vi.doMock('electron', () => ({
      nativeImage: {
        createFromBuffer: () => ({
          isEmpty: () => false,
          getSize: () => ({ width: 2000, height: 2800 }),
          resize: () => ({
            isEmpty: () => false,
            getSize: () => ({ width: 1097, height: 1536 }),
            resize: () => {
              throw new Error('already resized')
            },
            toJPEG: () => jpeg
          }),
          toJPEG: () => jpeg
        }),
        createFromPath: () => {
          throw new Error('path not used')
        }
      }
    }))

    const { normalizeImageForModel: load } = await import('../normalize-image-for-model')
    const result = await load({
      data: Buffer.from('png-bytes').toString('base64'),
      mimeType: 'image/png',
      fileName: 'page.png'
    })

    expect(result).toEqual({
      base64: jpeg.toString('base64'),
      mimeType: 'image/jpeg'
    })
  })
})
