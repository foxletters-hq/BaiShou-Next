import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { clearAgentDbRecoveryNotice, readAgentDbRecoveryNoticeAt } from '../db'

const mockState = vi.hoisted(() => ({ userDataDir: '' }))

vi.mock('electron', () => ({
  app: {
    getPath: () => mockState.userDataDir
  }
}))

describe('agent db recovery notice', () => {
  let userDataDir = ''

  beforeEach(() => {
    userDataDir = mkdtempSync(join(tmpdir(), 'baishou-user-data-'))
    mockState.userDataDir = userDataDir
  })

  afterEach(() => {
    rmSync(userDataDir, { recursive: true, force: true })
  })

  function createDbPath(): string {
    return join(userDataDir, 'baishou_agent.db')
  }

  function markerPath(): string {
    return join(userDataDir, 'baishou_agent_recovery.json')
  }

  it('reads and clears the recovery marker', () => {
    const dbPath = createDbPath()
    const backupPath = `${dbPath}.corrupted.123`
    writeFileSync(markerPath(), JSON.stringify({ dbPath, backupPath, createdAt: 123 }), 'utf8')

    expect(readAgentDbRecoveryNoticeAt(dbPath)).toEqual({
      dbPath,
      backupPath,
      createdAt: 123
    })

    clearAgentDbRecoveryNotice({ dbPath, backupPath, createdAt: 123 })
    expect(existsSync(markerPath())).toBe(false)
  })

  it('ignores a marker that belongs to another database path', () => {
    writeFileSync(
      markerPath(),
      JSON.stringify({ dbPath: '/another/baishou_agent.db', backupPath: null, createdAt: 123 }),
      'utf8'
    )

    expect(readAgentDbRecoveryNoticeAt(createDbPath())).toBeNull()
  })

  it('ignores a malformed recovery marker', () => {
    writeFileSync(markerPath(), '{ not-json', 'utf8')

    expect(readAgentDbRecoveryNoticeAt(createDbPath())).toBeNull()
  })
})
