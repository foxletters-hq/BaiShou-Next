import { describe, it, expect } from 'vitest'
import type { IFileSystem } from '../../../fs/file-system.types'
import {
  DeepSeekImportError,
  buildDeepSeekImportedSessionId,
  buildSessionAggregateFromDeepSeek,
  extractMainMessageChain,
  isSafeDeepSeekExportFilePath,
  isSafeDeepSeekSessionId,
  scanDeepSeekExtractedArchive
} from '../index'
import type { DeepSeekRawMessage, DeepSeekSessionFile } from '../deepseek-import.types'

function createMemoryFs(files: Record<string, string>): IFileSystem {
  const store = new Map<string, string>(Object.entries(files))
  const normalize = (p: string) => p.replace(/\/+/g, '/').replace(/\/$/, '') || '/'

  const dirEntries = (dirPath: string): string[] => {
    const prefix = `${normalize(dirPath)}/`
    const names = new Set<string>()
    for (const key of store.keys()) {
      if (key.startsWith(prefix)) {
        const rest = key.slice(prefix.length)
        const first = rest.split('/')[0]
        if (first) names.add(first)
      }
    }
    return [...names]
  }

  return {
    async exists(p) {
      const n = normalize(p)
      if (store.has(n)) return true
      return dirEntries(n).length > 0
    },
    async mkdir() {},
    async readFile(p) {
      const n = normalize(p)
      const val = store.get(n)
      if (val === undefined) {
        const err = new Error(`ENOENT: ${n}`) as Error & { code: string }
        err.code = 'ENOENT'
        throw err
      }
      return val
    },
    async writeFile(p, data) {
      store.set(normalize(p), data)
    },
    async copyFile(src, dest) {
      const val = store.get(normalize(src))
      if (val === undefined) throw new Error(`ENOENT: ${src}`)
      store.set(normalize(dest), val)
    },
    async unlink(p) {
      store.delete(normalize(p))
    },
    async readdir(p) {
      return dirEntries(p)
    },
    async stat(p) {
      const n = normalize(p)
      if (store.has(n)) {
        return { isFile: true, isDirectory: false, size: store.get(n)!.length }
      }
      if (dirEntries(n).length > 0) {
        return { isFile: false, isDirectory: true }
      }
      const err = new Error(`ENOENT: ${n}`) as Error & { code: string }
      err.code = 'ENOENT'
      throw err
    },
    async rename(oldPath, newPath) {
      const val = store.get(normalize(oldPath))
      if (val !== undefined) {
        store.set(normalize(newPath), val)
        store.delete(normalize(oldPath))
      }
    },
    async rm() {},
    async appendFile(p, data) {
      const n = normalize(p)
      store.set(n, (store.get(n) ?? '') + data)
    }
  }
}

describe('deepseek-import.parser', () => {
  it('should validate safe session ids and export file paths', () => {
    expect(isSafeDeepSeekSessionId('f530abcf-cb31-4e8f-9c44-00f4776aa34e')).toBe(true)
    expect(isSafeDeepSeekSessionId('../evil')).toBe(false)
    expect(isSafeDeepSeekSessionId('a/b')).toBe(false)
    expect(isSafeDeepSeekSessionId('..')).toBe(false)

    expect(isSafeDeepSeekExportFilePath('sess-1', 'chat_sessions/sess-1_files/img_1.png')).toBe(
      true
    )
    expect(isSafeDeepSeekExportFilePath('sess-1', 'chat_sessions/sess-1_files/../secret.txt')).toBe(
      false
    )
    expect(isSafeDeepSeekExportFilePath('sess-1', 'chat_sessions/sess-2_files/img_1.png')).toBe(
      false
    )
  })

  it('should generate deterministic session ids scoped per assistant', () => {
    const idA1 = buildDeepSeekImportedSessionId('ast-1', 'src-abc')
    const idA2 = buildDeepSeekImportedSessionId('ast-1', 'src-abc')
    const idB = buildDeepSeekImportedSessionId('ast-2', 'src-abc')

    expect(idA1).toBe(idA2)
    expect(idA1).not.toBe(idB)
    expect(idA1.startsWith('ds_')).toBe(true)
  })

  it('should walk active branch from current_message_id and drop discarded branches', () => {
    const messages: DeepSeekRawMessage[] = [
      { id: 1, parent_id: null, role: 'USER', fragments: [{ type: 'REQUEST', content: 'Q1' }] },
      {
        id: 2,
        parent_id: 1,
        role: 'ASSISTANT',
        fragments: [{ type: 'RESPONSE', content: 'A1-old' }]
      },
      {
        id: 3,
        parent_id: 1,
        role: 'ASSISTANT',
        fragments: [{ type: 'RESPONSE', content: 'A1-new' }]
      },
      { id: 4, parent_id: 3, role: 'USER', fragments: [{ type: 'REQUEST', content: 'Q2' }] },
      { id: 5, parent_id: 4, role: 'ASSISTANT', fragments: [{ type: 'RESPONSE', content: 'A2' }] }
    ]

    const chain = extractMainMessageChain(messages, 5)
    expect(chain.map((m) => m.id)).toEqual([1, 3, 4, 5])
  })

  it('should guard against cycles in parent_id links', () => {
    const messages: DeepSeekRawMessage[] = [
      { id: 1, parent_id: 2, role: 'USER', fragments: [{ type: 'REQUEST', content: 'loop1' }] },
      {
        id: 2,
        parent_id: 1,
        role: 'ASSISTANT',
        fragments: [{ type: 'RESPONSE', content: 'loop2' }]
      }
    ]
    const chain = extractMainMessageChain(messages, 2)
    expect(chain.length).toBe(2)
  })

  it('should scan v3 archive and return sorted session previews with feature flags', async () => {
    const fs = createMemoryFs({
      '/extract/manifest.json': JSON.stringify({ export_format_version: 3 }),
      '/extract/chat_session_index.json': JSON.stringify([
        {
          id: 's-old',
          title: 'Older chat',
          pinned: false,
          message_count: 2,
          inserted_at: '2025-04-20T10:00:00.000Z',
          updated_at: '2025-04-20T10:05:00.000Z'
        },
        {
          id: 's-new',
          title: 'Newer chat',
          pinned: true,
          message_count: 2,
          inserted_at: '2025-06-09T04:48:46.765Z',
          updated_at: '2025-06-09T04:48:55.010Z'
        }
      ]),
      '/extract/chat_sessions/s-old.json': JSON.stringify({
        id: 's-old',
        title: 'Older chat',
        pinned: false,
        current_message_id: 2,
        inserted_at: '2025-04-20T10:00:00.000Z',
        updated_at: '2025-04-20T10:05:00.000Z',
        messages: [
          {
            id: 1,
            parent_id: null,
            role: 'USER',
            inserted_at: '2025-04-20T10:00:01.000Z',
            fragments: [
              { type: 'REQUEST', content: 'look at this' },
              {
                type: 'FILE',
                files: [
                  {
                    id: 'f1',
                    file_name: 'photo.png',
                    is_image: true,
                    export_path: 'chat_sessions/s-old_files/f1_photo.png'
                  }
                ]
              }
            ]
          },
          {
            id: 2,
            parent_id: 1,
            role: 'ASSISTANT',
            thinking_enabled: true,
            search_enabled: true,
            inserted_at: '2025-04-20T10:00:10.000Z',
            fragments: [
              { type: 'TOOL_SEARCH', queries: ['q1'], results: [], status: 'FINISHED' },
              { type: 'THINK', content: 'thinking...', elapsed_secs: 4.5 },
              { type: 'RESPONSE', content: 'answer' },
              { type: 'CONTENT_RISK', content: 'AI generated', style: 'WARNING' }
            ]
          }
        ]
      }),
      '/extract/chat_sessions/s-new.json': JSON.stringify({
        id: 's-new',
        title: 'Newer chat',
        pinned: true,
        current_message_id: 2,
        inserted_at: '2025-06-09T04:48:46.765Z',
        updated_at: '2025-06-09T04:48:55.010Z',
        messages: [
          {
            id: 1,
            parent_id: null,
            role: 'USER',
            inserted_at: '2025-06-09T04:48:47.000Z',
            fragments: [{ type: 'REQUEST', content: '123' }]
          },
          {
            id: 2,
            parent_id: 1,
            role: 'ASSISTANT',
            inserted_at: '2025-06-09T04:48:50.000Z',
            fragments: [{ type: 'RESPONSE', content: '456' }]
          }
        ]
      })
    })

    const scan = await scanDeepSeekExtractedArchive(fs, '/extract')
    expect(scan.format).toBe('v3')
    expect(scan.exportFormatVersion).toBe(3)
    expect(scan.sessions.map((s) => s.sourceId)).toEqual(['s-new', 's-old'])
    expect(scan.totalMessages).toBe(4)
    expect(scan.sessions[1]).toMatchObject({
      hasThinking: true,
      hasSearch: true,
      imageCount: 1
    })
  })

  it('should throw typed errors for newer version, unsupported version, and unrecognized archive', async () => {
    const newerFs = createMemoryFs({
      '/extract/manifest.json': JSON.stringify({ export_format_version: 9 })
    })
    await expect(scanDeepSeekExtractedArchive(newerFs, '/extract')).rejects.toMatchObject({
      code: 'NEWER_VERSION'
    })

    const oldFs = createMemoryFs({
      '/extract/manifest.json': JSON.stringify({ export_format_version: 2 })
    })
    await expect(scanDeepSeekExtractedArchive(oldFs, '/extract')).rejects.toMatchObject({
      code: 'UNSUPPORTED_VERSION'
    })

    const emptyFs = createMemoryFs({
      '/extract/readme.txt': 'not a deepseek archive'
    })
    await expect(scanDeepSeekExtractedArchive(emptyFs, '/extract')).rejects.toBeInstanceOf(
      DeepSeekImportError
    )
    await expect(scanDeepSeekExtractedArchive(emptyFs, '/extract')).rejects.toMatchObject({
      code: 'UNRECOGNIZED_ARCHIVE'
    })
  })

  it('should scan legacy conversations.json when manifest.json is absent', async () => {
    const fs = createMemoryFs({
      '/extract/conversations.json': JSON.stringify([
        {
          id: 'conv-1',
          title: 'Legacy Chat',
          inserted_at: '2025-01-10T08:00:00.000Z',
          updated_at: '2025-01-10T08:02:00.000Z',
          mapping: {
            root: { id: 'root', parent: null, children: ['n1'], message: null },
            n1: {
              id: 'n1',
              parent: 'root',
              children: ['n2'],
              message: {
                role: 'USER',
                inserted_at: '2025-01-10T08:00:01.000Z',
                fragments: [{ type: 'REQUEST', content: 'Hello legacy' }]
              }
            },
            n2: {
              id: 'n2',
              parent: 'n1',
              children: [],
              message: {
                role: 'ASSISTANT',
                inserted_at: '2025-01-10T08:00:05.000Z',
                fragments: [
                  { type: 'THINK', content: 'Legacy think' },
                  { type: 'RESPONSE', content: 'Legacy answer' }
                ]
              }
            }
          }
        }
      ])
    })

    const scan = await scanDeepSeekExtractedArchive(fs, '/extract')
    expect(scan.format).toBe('legacy')
    expect(scan.sessions).toHaveLength(1)
    expect(scan.sessions[0]).toMatchObject({
      sourceId: 'conv-1',
      title: 'Legacy Chat',
      messageCount: 2,
      hasThinking: true
    })
  })

  it('should map THINK, TOOL_SEARCH, TOOL_OPEN, FILE, TEMPLATE_RESPONSE and skip CONTENT_RISK', async () => {
    const sourceSession: DeepSeekSessionFile = {
      id: 'sess-full',
      title: 'Full Feature Chat',
      pinned: true,
      current_message_id: 4,
      inserted_at: '2025-04-20T17:15:13.215Z',
      updated_at: '2025-04-20T17:34:09.800Z',
      messages: [
        {
          id: 1,
          parent_id: null,
          role: 'USER',
          status: 'FINISHED',
          inserted_at: '2025-04-20T17:15:14.455Z',
          fragments: [
            { type: 'REQUEST', content: 'Analyze this' },
            {
              type: 'FILE',
              files: [
                {
                  id: 'img1',
                  file_name: 'chart.png',
                  file_size: 2048,
                  is_image: true,
                  export_path: 'chat_sessions/sess-full_files/img1_chart.png'
                },
                {
                  id: 'doc1',
                  file_name: 'report.pdf',
                  file_size: 4096,
                  is_image: false,
                  export_path: null
                }
              ]
            }
          ]
        },
        {
          id: 2,
          parent_id: 1,
          role: 'ASSISTANT',
          status: 'FINISHED',
          inserted_at: '2025-04-20T17:15:20.000Z',
          fragments: [
            {
              type: 'TOOL_SEARCH',
              queries: ['ai ranking'],
              status: 'FINISHED',
              results: Array.from({ length: 20 }, (_, i) => ({
                url: `https://example.com/${i}`,
                title: `Result ${i}`,
                snippet: 'x'.repeat(400),
                site_name: 'Example'
              }))
            },
            {
              type: 'TOOL_OPEN',
              status: 'FINISHED',
              url: 'https://example.com/0',
              title: 'Result 0'
            },
            { type: 'THINK', content: 'Step-by-step reasoning', elapsed_secs: 12.3 },
            { type: 'RESPONSE', content: 'Final answer' },
            { type: 'CONTENT_RISK', content: 'AI generated warning', style: 'WARNING' },
            { type: 'TIP', content: 'Some tip', style: 'INFO' }
          ]
        },
        {
          id: 3,
          parent_id: 2,
          role: 'USER',
          status: 'FINISHED',
          inserted_at: '2025-04-20T17:20:00.000Z',
          fragments: [{ type: 'REQUEST', content: 'Filtered turn' }]
        },
        {
          id: 4,
          parent_id: 3,
          role: 'ASSISTANT',
          status: 'CONTENT_FILTER',
          inserted_at: '2025-04-20T17:20:05.000Z',
          fragments: [
            { type: 'THINK', content: 'Should be omitted when content filtered' },
            { type: 'RESPONSE', content: 'Should also be omitted' },
            { type: 'TEMPLATE_RESPONSE', content: '该内容暂无法回答' }
          ]
        }
      ]
    }

    const { aggregate, importedAttachments } = await buildSessionAggregateFromDeepSeek({
      sourceSession,
      targetSessionId: 'ds_001_sess-full',
      assistantId: 'ast-1',
      vaultId: 'vault-1',
      vaultName: 'Personal',
      resolveImageAttachment: async (f) => ({
        name: f.file_name,
        fileName: 'img1_chart.png',
        filePath: '/vault/Attachments/ds_001_sess-full/img1_chart.png',
        relativePath: 'ds_001_sess-full/img1_chart.png',
        mimeType: 'image/png',
        size: f.file_size
      })
    })

    expect(importedAttachments).toBe(1)
    expect(aggregate.session.title).toBe('Full Feature Chat')
    expect(aggregate.session.isPinned).toBe(true)
    expect(aggregate.messages).toHaveLength(4)

    // User message has text (with non-image file note) + image attachment part
    const msg0 = aggregate.messages[0]!
    expect(msg0.role).toBe('user')
    expect(msg0.parts.find((p) => p.type === 'text')?.data.text).toContain('[report.pdf]')
    expect(msg0.parts.find((p) => p.type === 'attachment')?.data).toMatchObject({
      type: 'image',
      isImage: true,
      relativePath: 'ds_001_sess-full/img1_chart.png'
    })

    // Assistant message has web_search (capped to 12), web_fetch, reasoning, response; no CONTENT_RISK/TIP
    const msg1 = aggregate.messages[1]!
    expect(msg1.parts.map((p) => p.type)).toEqual(['tool', 'tool', 'text', 'text'])
    expect(typeof msg1.parts[0]!.data.result).toBe('string')
    expect(typeof msg1.parts[1]!.data.result).toBe('string')
    const searchResult = JSON.parse(msg1.parts[0]!.data.result as string) as {
      totalCount: number
      results: unknown[]
    }
    expect(searchResult.totalCount).toBe(20)
    expect(searchResult.results).toHaveLength(12)
    expect(msg1.parts[2]!.data).toMatchObject({
      text: 'Step-by-step reasoning',
      isReasoning: true,
      elapsedSecs: 12.3
    })
    expect(msg1.parts[3]!.data).toMatchObject({ text: 'Final answer' })

    // CONTENT_FILTER assistant message keeps only TEMPLATE_RESPONSE
    const msg3 = aggregate.messages[3]!
    expect(msg3.parts).toHaveLength(1)
    expect(msg3.parts[0]!.data.text).toBe('该内容暂无法回答')
  })
})
