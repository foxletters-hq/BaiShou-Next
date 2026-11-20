import * as fs from 'node:fs'
import * as fsp from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createNodeFileSystem } from '@baishou/core-desktop'
import { DesktopDeepSeekImportService } from '../desktop-deepseek-import.service'

const tempDirs: string[] = []

async function makeTempDir(prefix: string): Promise<string> {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), prefix))
  tempDirs.push(dir)
  return dir
}

afterEach(async () => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop()!
    await fsp.rm(dir, { recursive: true, force: true }).catch(() => {})
  }
})

describe('DesktopDeepSeekImportService', () => {
  it('scans extracted DeepSeek v3 archive, hides payloadDir, imports via token, and cleans up temp dir', async () => {
    const baseTemp = await makeTempDir('ds-desktop-test-')
    const createdExtractDirs: string[] = []
    const upsertedSessions: string[] = []
    const flushedSessions: string[] = []
    const broadcastDataChanged = vi.fn()

    const service = new DesktopDeepSeekImportService({
      fileSystem: createNodeFileSystem(),
      getTempBaseDir: () => baseTemp,
      extractZip: async (_zipPath, targetDir) => {
        createdExtractDirs.push(targetDir)
        await fsp.mkdir(path.join(targetDir, 'chat_sessions'), { recursive: true })
        await fsp.writeFile(
          path.join(targetDir, 'manifest.json'),
          JSON.stringify({ export_format_version: 3 }),
          'utf8'
        )
        await fsp.writeFile(
          path.join(targetDir, 'chat_session_index.json'),
          JSON.stringify([
            {
              id: 'sess-1',
              title: '桌面导入测试',
              inserted_at: '2026-11-20T01:00:00Z',
              updated_at: '2026-11-20T01:05:00Z'
            }
          ]),
          'utf8'
        )
        await fsp.writeFile(
          path.join(targetDir, 'chat_sessions', 'sess-1.json'),
          JSON.stringify({
            id: 'sess-1',
            title: '桌面导入测试',
            current_message_id: 2,
            inserted_at: '2026-11-20T01:00:00Z',
            updated_at: '2026-11-20T01:05:00Z',
            messages: [
              {
                id: 1,
                parent_id: null,
                role: 'USER',
                inserted_at: '2026-11-20T01:00:00Z',
                fragments: [{ type: 'REQUEST', content: '你好' }]
              },
              {
                id: 2,
                parent_id: 1,
                role: 'ASSISTANT',
                inserted_at: '2026-11-20T01:01:00Z',
                fragments: [{ type: 'RESPONSE', content: '你好！欢迎来到桌面端。' }]
              }
            ]
          }),
          'utf8'
        )
      },
      getRuntimeContext: async () => ({
        vaultId: 'vlt_desktop',
        vaultName: 'Personal',
        attachmentsBaseDir: path.join(baseTemp, 'attachments'),
        sessionRepo: {
          findAllSessions: async () => [],
          upsertAggregate: async (aggregate) => {
            upsertedSessions.push(aggregate.session.id)
          }
        },
        sessionManager: {
          flushSessionToDisk: async (id) => {
            flushedSessions.push(id)
          }
        },
        assistantManager: {
          findById: async (id) => ({ id, name: 'Latte' }),
          create: async () => {}
        }
      }),
      broadcastDataChanged
    })

    const payload = await service.scanZip('/fake/path/deepseek_data.zip')
    expect(payload.fileName).toBe('deepseek_data.zip')
    expect(payload.scanToken).toBeTruthy()
    expect('payloadDir' in payload.scanResult).toBe(false)
    expect(payload.scanResult.sessions).toHaveLength(1)
    expect(createdExtractDirs).toHaveLength(1)
    expect(fs.existsSync(createdExtractDirs[0]!)).toBe(true)

    const importResult = await service.executeImport({
      scanToken: payload.scanToken,
      selectedSessionIds: ['sess-1'],
      target: { mode: 'existing', assistantId: 'latte', assistantName: 'Latte' }
    })

    expect(importResult.importedSessions).toBe(1)
    expect(importResult.importedMessages).toBe(2)
    expect(upsertedSessions).toHaveLength(1)
    expect(flushedSessions).toHaveLength(1)
    expect(broadcastDataChanged).toHaveBeenCalledTimes(1)
    expect(fs.existsSync(createdExtractDirs[0]!)).toBe(false)

    // 复用已清理的 token 应报错
    await expect(
      service.executeImport({
        scanToken: payload.scanToken,
        selectedSessionIds: ['sess-1'],
        target: { mode: 'existing', assistantId: 'latte', assistantName: 'Latte' }
      })
    ).rejects.toThrow()
  })

  it('cleans up temporary directory when archive scan fails', async () => {
    const baseTemp = await makeTempDir('ds-desktop-fail-')
    const createdExtractDirs: string[] = []

    const service = new DesktopDeepSeekImportService({
      fileSystem: createNodeFileSystem(),
      getTempBaseDir: () => baseTemp,
      extractZip: async (_zipPath, targetDir) => {
        createdExtractDirs.push(targetDir)
        await fsp.writeFile(path.join(targetDir, 'unrelated.txt'), 'not deepseek', 'utf8')
      }
    })

    await expect(service.scanZip('/fake/path/invalid.zip')).rejects.toThrow()
    expect(createdExtractDirs).toHaveLength(1)
    expect(fs.existsSync(createdExtractDirs[0]!)).toBe(false)
  })
})
