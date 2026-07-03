import { describe, expect, it } from 'vitest'
import {
  extractAttachmentsFromParts,
  extractUserMessagePayload,
  hasUserMessagePayload
} from '../agent/actions/base.action'

describe('extractUserMessagePayload', () => {
  it('treats image-only messages as sendable', () => {
    const payload = extractUserMessagePayload({
      parts: [
        { type: 'text', data: { text: '' } },
        {
          type: 'image',
          data: {
            fileName: 'photo.png',
            filePath: 'D:/vault/attachments/photo.png',
            isImage: true,
            type: 'image',
            mimeType: 'image/png'
          }
        }
      ]
    })

    expect(payload.userText).toBe('')
    expect(payload.attachments).toHaveLength(1)
    expect(payload.attachments?.[0]).toMatchObject({
      type: 'image',
      name: 'photo.png',
      isImage: true
    })
    expect(hasUserMessagePayload(payload)).toBe(true)
  })

  it('returns false for truly empty messages', () => {
    const payload = extractUserMessagePayload({
      parts: [{ type: 'text', data: { text: '   ' } }]
    })
    expect(hasUserMessagePayload(payload)).toBe(false)
  })
})

describe('extractAttachmentsFromParts', () => {
  it('reads attachment parts stored as attachment type', () => {
    const attachments = extractAttachmentsFromParts([
      {
        type: 'attachment',
        data: {
          fileName: 'notes.pdf',
          filePath: '/tmp/notes.pdf',
          isPdf: true,
          mimeType: 'application/pdf'
        }
      }
    ])

    expect(attachments).toHaveLength(1)
    expect(attachments?.[0]?.type).toBe('file')
    expect(attachments?.[0]?.isPdf).toBe(true)
  })
})
