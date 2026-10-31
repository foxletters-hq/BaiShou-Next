import { describe, expect, it, vi } from 'vitest'
import {
  fileToChatAttachment,
  resolveDroppedFilePath,
  shouldRejectOversizedTextAttachment
} from '../input-bar-attachment.util'

describe('input-bar-attachment.util', () => {
  it('keeps Electron file.path for dropped files', async () => {
    const file = new File(['hello'], 'note.txt', { type: 'text/plain' }) as File & { path?: string }
    file.path = 'D:/docs/note.txt'
    const att = await fileToChatAttachment(file)
    expect(att.filePath).toBe('D:/docs/note.txt')
    expect(att.data).toBeUndefined()
    expect(att.isText).toBe(true)
  })

  it('should classify .py files as text attachments', async () => {
    const file = new File(['print(1)'], 'main.py', { type: '' }) as File & { path?: string }
    file.path = 'D:/docs/main.py'
    const att = await fileToChatAttachment(file)
    expect(att.isText).toBe(true)
    expect(att.isImage).toBe(false)
    expect(att.isPdf).toBe(false)
  })

  it('resolves path via getPathForFile when file.path is missing', () => {
    const file = new File(['x'], 'shot.png', { type: 'image/png' })
    const getPathForFile = vi.fn(() => 'D:/shots/shot.png')
    ;(
      window as Window & { api?: { agentWorkspace?: { getPathForFile?: (next: File) => string } } }
    ).api = { agentWorkspace: { getPathForFile } }
    expect(resolveDroppedFilePath(file)).toBe('D:/shots/shot.png')
    expect(getPathForFile).toHaveBeenCalledWith(file)
    delete (window as Window & { api?: unknown }).api
  })

  it('does not reject workspace path refs that exceed the in-memory text limit', () => {
    expect(
      shouldRejectOversizedTextAttachment({
        isText: true,
        fileSize: 800 * 1024,
        relativePath: 'src/app.ts',
        filePath: 'D:/proj/src/app.ts'
      })
    ).toBe(false)
  })

  it('rejects oversized in-memory text blobs', () => {
    expect(
      shouldRejectOversizedTextAttachment({
        isText: true,
        fileSize: 800 * 1024,
        filePath: 'blob:https://local/1'
      })
    ).toBe(true)
  })
})
