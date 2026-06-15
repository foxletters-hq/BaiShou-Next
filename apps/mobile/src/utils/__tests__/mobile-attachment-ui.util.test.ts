import { describe, expect, it } from 'vitest'
import { resolveMobileAttachmentFilePath } from '../mobile-attachment-ui.util'

describe('resolveMobileAttachmentFilePath', () => {
  const root = '/storage/emulated/0/BaiShou_Root'

  it('rewrites desktop absolute paths to mobile storage root', () => {
    const desktop = 'local:///D:/BaiShou/Vaults/Personal/Attachments/session-1/photo_123.png'
    expect(resolveMobileAttachmentFilePath(desktop, root)).toBe(
      'file:///storage/emulated/0/BaiShou_Root/Personal/Attachments/session-1/photo_123.png'
    )
  })

  it('keeps paths already under storage root', () => {
    const local = '/storage/emulated/0/BaiShou_Root/Personal/Attachments/session-1/photo.png'
    expect(resolveMobileAttachmentFilePath(local, root)).toBe(`file://${local}`)
  })
})
