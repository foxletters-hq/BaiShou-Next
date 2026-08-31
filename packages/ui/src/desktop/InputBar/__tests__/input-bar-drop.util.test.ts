import { describe, expect, it, vi } from 'vitest'
import {
  collectDroppedFiles,
  ingestDroppedAttachments,
  INPUT_BAR_WORKSPACE_EXPLORER_DROP_MIME,
  shouldAcceptAttachmentDrag
} from '../input-bar-drop.util'
import type { InputBarAttachment } from '../input-bar-attachment.util'

function mockDataTransfer(params: { types?: string[]; files?: File[] }): DataTransfer {
  return {
    types: params.types ?? [],
    files: params.files ?? []
  } as unknown as DataTransfer
}

describe('input-bar-drop.util', () => {
  it('accepts OS files for both intakes', () => {
    const dt = mockDataTransfer({ types: ['Files'] })
    expect(shouldAcceptAttachmentDrag(dt, 'companion')).toBe(true)
    expect(shouldAcceptAttachmentDrag(dt, 'workspace')).toBe(true)
  })

  it('only workspace intake accepts explorer mime', () => {
    const dt = mockDataTransfer({ types: [INPUT_BAR_WORKSPACE_EXPLORER_DROP_MIME] })
    expect(shouldAcceptAttachmentDrag(dt, 'companion')).toBe(false)
    expect(shouldAcceptAttachmentDrag(dt, 'workspace')).toBe(true)
  })

  it('rejects plain text drags', () => {
    const dt = mockDataTransfer({ types: ['text/plain'] })
    expect(shouldAcceptAttachmentDrag(dt, 'companion')).toBe(false)
    expect(shouldAcceptAttachmentDrag(dt, 'workspace')).toBe(false)
  })

  it('collects dropped files', () => {
    const file = new File(['hi'], 'a.txt', { type: 'text/plain' })
    expect(collectDroppedFiles(mockDataTransfer({ files: [file] }))).toEqual([file])
  })

  it('companion intake uses OS files and ignores resolver', async () => {
    const file = new File(['hi'], 'a.txt', { type: 'text/plain' })
    const resolveDropAttachments = vi.fn(async () => [
      {
        id: 'resolved',
        fileName: 'from-tree.md',
        filePath: '/tmp/from-tree.md',
        isImage: false,
        isPdf: false
      } satisfies InputBarAttachment
    ])
    const fileToAttachment = vi.fn(async (next: File) => ({
      id: 'os',
      fileName: next.name,
      filePath: '/tmp/a.txt',
      isImage: false,
      isPdf: false,
      isText: true
    }))

    const result = await ingestDroppedAttachments({
      dataTransfer: mockDataTransfer({ types: ['Files'], files: [file] }),
      intake: 'companion',
      resolveDropAttachments,
      fileToAttachment
    })

    expect(resolveDropAttachments).not.toHaveBeenCalled()
    expect(fileToAttachment).toHaveBeenCalledWith(file)
    expect(result).toEqual([
      {
        id: 'os',
        fileName: 'a.txt',
        filePath: '/tmp/a.txt',
        isImage: false,
        isPdf: false,
        isText: true
      }
    ])
  })

  it('workspace intake prefers resolver attachments', async () => {
    const resolved: InputBarAttachment[] = [
      {
        id: 'tree',
        fileName: 'notes.md',
        filePath: 'D:/proj/notes.md',
        isImage: false,
        isPdf: false,
        isText: true
      }
    ]
    const fileToAttachment = vi.fn()
    const result = await ingestDroppedAttachments({
      dataTransfer: mockDataTransfer({ types: [INPUT_BAR_WORKSPACE_EXPLORER_DROP_MIME] }),
      intake: 'workspace',
      resolveDropAttachments: async () => resolved,
      fileToAttachment
    })
    expect(result).toEqual(resolved)
    expect(fileToAttachment).not.toHaveBeenCalled()
  })

  it('workspace intake falls back to OS files when resolver returns null', async () => {
    const file = new File(['%PDF'], 'doc.pdf', { type: 'application/pdf' })
    const fileToAttachment = vi.fn(async (next: File) => ({
      id: 'pdf',
      fileName: next.name,
      filePath: 'D:/inbox/doc.pdf',
      isImage: false,
      isPdf: true
    }))
    const result = await ingestDroppedAttachments({
      dataTransfer: mockDataTransfer({ types: ['Files'], files: [file] }),
      intake: 'workspace',
      resolveDropAttachments: async () => null,
      fileToAttachment
    })
    expect(result[0]?.filePath).toBe('D:/inbox/doc.pdf')
    expect(fileToAttachment).toHaveBeenCalledWith(file)
  })
})
