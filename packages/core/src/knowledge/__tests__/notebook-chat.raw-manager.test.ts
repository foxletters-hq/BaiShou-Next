import { describe, expect, it } from 'vitest'
import { NotebookRawManager } from '../../raw-data/managers/notebook.raw-manager'
import { NotebookChatRawManager } from '../notebook-chat.raw-manager'
import type { IFileSystem } from '../../fs/file-system.types'
import type { IStoragePathService } from '../../vault/storage-path.types'

class MemoryFs implements IFileSystem {
  private files = new Map<string, string>()

  private key(p: string): string {
    return p.replace(/\\/g, '/')
  }

  async exists(p: string): Promise<boolean> {
    return this.files.has(this.key(p))
  }
  async readFile(p: string): Promise<string> {
    const value = this.files.get(this.key(p))
    if (value == null) throw new Error(`missing ${p}`)
    return value
  }
  async writeFile(p: string, data: string): Promise<void> {
    this.files.set(this.key(p), data)
  }
  async appendFile(p: string, data: string): Promise<void> {
    const key = this.key(p)
    this.files.set(key, `${this.files.get(key) || ''}${data}`)
  }
  async mkdir(): Promise<void> {}
  async readdir(): Promise<string[]> {
    return []
  }
  async unlink(): Promise<void> {}
  async rename(): Promise<void> {}
  async copyFile(): Promise<void> {}
  async rm(): Promise<void> {}
  async stat(): Promise<{ isFile: boolean; isDirectory: boolean; size: number; mtimeMs: number }> {
    return { isFile: true, isDirectory: false, size: 0, mtimeMs: 0 }
  }
}

describe('NotebookChatRawManager', () => {
  it('keeps sessions on the notebook and updates title from the first question', async () => {
    const notebooks = new NotebookRawManager(
      { getNotebooksBaseDirectory: async () => '/vault/Notebooks' } as IStoragePathService,
      new MemoryFs()
    )
    const chats = new NotebookChatRawManager(notebooks)
    const session = await chats.createSession({ notebookId: 'nb1', assistantId: 'ast-1' })
    await chats.appendMessage({
      notebookId: 'nb1',
      sessionId: session.id,
      role: 'user',
      text: '这篇报告的结论是什么？'
    })
    const listed = await chats.listSessions('nb1')
    expect(listed).toHaveLength(1)
    expect(listed[0]?.title).toBe('这篇报告的结论是什么？')
    expect(listed[0]?.assistantId).toBe('ast-1')
  })

  it('stores assistant reasoning with the answer', async () => {
    const notebooks = new NotebookRawManager(
      { getNotebooksBaseDirectory: async () => '/vault/Notebooks' } as IStoragePathService,
      new MemoryFs()
    )
    const chats = new NotebookChatRawManager(notebooks)
    const session = await chats.createSession({ notebookId: 'nb1', assistantId: 'ast-1' })
    await chats.appendMessage({
      notebookId: 'nb1',
      sessionId: session.id,
      role: 'assistant',
      text: '结论是对齐仍有分歧。',
      reasoning: '  先看报告第 2 页  '
    })
    const rows = await chats.listMessages('nb1', session.id)
    expect(rows[0]?.text).toBe('结论是对齐仍有分歧。')
    expect(rows[0]?.reasoning).toBe('先看报告第 2 页')
  })
})
