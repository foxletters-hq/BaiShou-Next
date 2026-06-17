import { describe, expect, it, vi } from 'vitest'
import type { IFileSystem } from '../../fs/file-system.types'
import { writeSessionAggregateFile } from '../legacy-runtime-artifacts.shared'
import type { RawSqlExecutor } from '../legacy-migration.shared'

function createTrackingFileSystem(): {
  fileSystem: IFileSystem
  writes: string[]
  appends: string[]
  renames: Array<{ from: string; to: string }>
} {
  const files = new Map<string, string>()
  const writes: string[] = []
  const appends: string[] = []
  const renames: Array<{ from: string; to: string }> = []

  const fileSystem: IFileSystem = {
    exists: async (p) => files.has(p),
    mkdir: async () => undefined,
    readFile: async (p) => files.get(p) ?? '',
    writeFile: async (p, data) => {
      writes.push(p)
      files.set(p, data)
    },
    appendFile: async (p, data) => {
      appends.push(p)
      files.set(p, (files.get(p) ?? '') + data)
    },
    copyFile: vi.fn(),
    unlink: async (p) => {
      files.delete(p)
    },
    readdir: async () => [],
    stat: async (p) => ({
      isFile: files.has(p),
      isDirectory: false
    }),
    rename: async (from, to) => {
      renames.push({ from, to })
      const content = files.get(from)
      if (content !== undefined) {
        files.set(to, content)
        files.delete(from)
      }
    },
    rm: vi.fn()
  }

  return { fileSystem, writes, appends, renames }
}

describe('writeSessionAggregateFile', () => {
  it('streams messages to a temp file then atomically renames', async () => {
    const { fileSystem, writes, appends, renames } = createTrackingFileSystem()
    const sessionPath = '/vault/Sessions/s1.json'

    const executeRawSql: RawSqlExecutor = async (_client, sql, params) => {
      if (sql.includes('FROM agent_messages')) {
        return {
          rows: [
            {
              id: 'm1',
              session_id: 's1',
              order_index: 0,
              created_at: 1_700_000_000_000,
              is_summary: 0
            }
          ]
        }
      }
      if (sql.includes('FROM agent_parts')) {
        return {
          rows: [
            {
              id: 'p1',
              message_id: params?.[0],
              order_index: 0,
              type: 'text',
              data: JSON.stringify({ text: 'hello' })
            }
          ]
        }
      }
      return { rows: [] }
    }

    await writeSessionAggregateFile(
      fileSystem,
      sessionPath,
      { id: 's1', vaultName: 'Personal' },
      {},
      executeRawSql,
      's1'
    )

    expect(writes).toEqual([`${sessionPath}.tmp`])
    expect(appends.every((p) => p === `${sessionPath}.tmp`)).toBe(true)
    expect(renames).toEqual([{ from: `${sessionPath}.tmp`, to: sessionPath }])

    const finalJson = await fileSystem.readFile(sessionPath)
    const parsed = JSON.parse(finalJson) as {
      session: { id: string }
      messages: Array<{ id: string; parts: Array<{ id: string }> }>
    }
    expect(parsed.session.id).toBe('s1')
    expect(parsed.messages).toHaveLength(1)
    expect(parsed.messages[0]?.parts[0]?.id).toBe('p1')
  })
})
