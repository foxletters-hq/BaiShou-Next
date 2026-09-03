import { describe, expect, it } from 'vitest'
import {
  getWorkspaceBubbleAttachments,
  getWorkspaceUserAttachments,
  getWorkspaceUserFileRefs,
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
        isImage: false,
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

describe('workspace file cite display', () => {
  it('reads persisted file refs and hides inline text attachments from the card row', () => {
    const message = {
      id: 'm1',
      role: 'user',
      content: '你能看到这个吗',
      fileRefs: [
        {
          relativePath: 'docs/月光邮局-Latte.md',
          selection: { startLine: 8, endLine: 20 }
        }
      ],
      attachments: [
        {
          id: 'a1',
          fileName: '月光邮局-Latte.md',
          filePath: 'D:/vault/docs/月光邮局-Latte.md',
          relativePath: 'docs/月光邮局-Latte.md',
          isImage: false,
          isPdf: false,
          isText: true,
          selection: { startLine: 8, endLine: 20 }
        },
        {
          id: 'a2',
          fileName: 'shot.png',
          filePath: 'D:/vault/shot.png',
          isImage: true,
          isPdf: false
        }
      ]
    }
    expect(getWorkspaceUserFileRefs(message)).toEqual([
      {
        relativePath: 'docs/月光邮局-Latte.md',
        selection: { startLine: 8, endLine: 20 },
        comment: undefined,
        origin: undefined
      }
    ])
    const cards = getWorkspaceBubbleAttachments(message)
    expect(cards).toHaveLength(1)
    expect(cards[0]?.fileName).toBe('shot.png')
  })

  it('reconstructs file refs from old attachment-only messages', () => {
    expect(
      getWorkspaceUserFileRefs({
        id: 'm1',
        role: 'user',
        attachments: [
          {
            id: 'a1',
            fileName: 'app.ts',
            filePath: '/tmp/src/app.ts',
            relativePath: 'src/app.ts',
            isImage: false,
            isPdf: false,
            isText: true,
            selection: { startLine: 12, endLine: 12 }
          }
        ]
      })
    ).toEqual([
      {
        relativePath: 'src/app.ts',
        selection: { startLine: 12, endLine: 12 },
        comment: undefined,
        origin: undefined
      }
    ])
  })
})
