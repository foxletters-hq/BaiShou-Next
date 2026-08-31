import { describe, expect, it } from 'vitest'
import {
  getWorkspaceUserAttachments,
  hasWorkspaceComposerPayload,
  normalizeWorkspaceSendAttachments
} from '../workspace-message-display.util'

describe('normalizeWorkspaceSendAttachments', () => {
  it('drops empty arrays', () => {
    expect(normalizeWorkspaceSendAttachments(undefined)).toBeUndefined()
    expect(normalizeWorkspaceSendAttachments([])).toBeUndefined()
  })

  it('keeps non-empty attachment lists', () => {
    const attachments = [{ fileName: 'doc.pdf', isPdf: true }]
    expect(normalizeWorkspaceSendAttachments(attachments)).toEqual(attachments)
  })
})

describe('hasWorkspaceComposerPayload', () => {
  it('accepts attachment-only sends', () => {
    expect(
      hasWorkspaceComposerPayload({
        text: '   ',
        attachments: [{ fileName: 'brief.pdf' }]
      })
    ).toBe(true)
  })

  it('rejects empty composer state', () => {
    expect(hasWorkspaceComposerPayload({ text: '', attachments: [] })).toBe(false)
  })
})

describe('getWorkspaceUserAttachments', () => {
  it('prefers mapped attachments on the message', () => {
    const attachments = [
      {
        id: 'a1',
        fileName: 'brief.pdf',
        filePath: 'local:///D:/vault/brief.pdf',
        isPdf: true
      }
    ]
    expect(
      getWorkspaceUserAttachments({
        id: 'm1',
        role: 'user',
        attachments
      })
    ).toEqual(attachments)
  })

  it('reads pdf attachment parts when message.attachments is missing', () => {
    const result = getWorkspaceUserAttachments({
      id: 'm1',
      role: 'user',
      parts: [
        {
          id: 'p1',
          messageId: 'm1',
          sessionId: 's1',
          type: 'attachment',
          data: {
            fileName: 'brief.pdf',
            filePath: 'D:/vault/brief.pdf',
            isPdf: true,
            mimeType: 'application/pdf'
          }
        }
      ]
    })
    expect(result).toHaveLength(1)
    expect(result[0]?.fileName).toBe('brief.pdf')
    expect(result[0]?.isPdf).toBe(true)
  })
})
