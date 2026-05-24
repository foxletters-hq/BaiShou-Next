import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import type { SyncSessionLog, SyncSummary } from '@baishou/shared'
import { IOperationLogService } from '../operation-log.interface'
import { OperationLogService } from '../operation-log.service'

const makeLog = (overrides: Partial<SyncSessionLog> = {}): SyncSessionLog => ({
  sessionId: overrides.sessionId ?? 'session-1',
  deviceId: 'device-desktop',
  direction: 'full-sync',
  startedAt: '2026-05-17T10:00:00.000Z',
  completedAt: '2026-05-17T10:00:01.500Z',
  success: true,
  operations: [
    {
      id: 'op-1',
      type: 'upload',
      filePath: 'Journals/2026/05/2026-05-15.md',
      hashBefore: null,
      hashAfter: 'a1b2c3',
      size: 2048,
      timestamp: '2026-05-17T10:00:01.000Z'
    }
  ],
  summary: {
    uploaded: 1,
    downloaded: 0,
    deletedRemote: 0,
    deletedLocal: 0,
    conflicts: 0,
    skipped: 0
  },
  ...overrides
})

describe('OperationLogService', () => {
  let service: IOperationLogService
  let logDir: string

  beforeEach(() => {
    logDir = path.join(os.tmpdir(), `baishou-test-sync-log-${Date.now()}`)
    fs.mkdirSync(logDir, { recursive: true })
    service = new OperationLogService(logDir)
  })

  afterEach(() => {
    if (fs.existsSync(logDir)) {
      fs.rmSync(logDir, { recursive: true, force: true })
    }
  })

  describe('writeLog', () => {
    it('should write a session log to disk', async () => {
      const log = makeLog()
      await service.writeLog(log)

      const filePath = path.join(logDir, 'session-1.json')
      expect(fs.existsSync(filePath)).toBe(true)

      const content = JSON.parse(fs.readFileSync(filePath, 'utf8'))
      expect(content.sessionId).toBe('session-1')
      expect(content.summary.uploaded).toBe(1)
    })

    it('should create log directory if it does not exist', async () => {
      const nestedDir = path.join(logDir, 'deep', 'nested')
      const nestedService = new OperationLogService(nestedDir)
      const log = makeLog()

      await nestedService.writeLog(log)

      expect(fs.existsSync(path.join(nestedDir, 'session-1.json'))).toBe(true)

      // cleanup nested dir
      fs.rmSync(path.dirname(path.dirname(nestedDir)), {
        recursive: true,
        force: true
      })
    })
  })

  describe('getRecentLogs', () => {
    it('should return logs sorted by completedAt descending', async () => {
      await service.writeLog(makeLog({ sessionId: 'a', completedAt: '2026-05-17T10:00:00.000Z' }))
      await service.writeLog(makeLog({ sessionId: 'b', completedAt: '2026-05-17T11:00:00.000Z' }))
      await service.writeLog(makeLog({ sessionId: 'c', completedAt: '2026-05-17T09:00:00.000Z' }))

      const logs = await service.getRecentLogs()
      expect(logs).toHaveLength(3)
      expect(logs[0]!.completedAt).toBe('2026-05-17T11:00:00.000Z')
      expect(logs[1]!.completedAt).toBe('2026-05-17T10:00:00.000Z')
      expect(logs[2]!.completedAt).toBe('2026-05-17T09:00:00.000Z')
    })

    it('should respect the limit parameter', async () => {
      await service.writeLog(makeLog({ sessionId: 'a' }))
      await service.writeLog(makeLog({ sessionId: 'b' }))
      await service.writeLog(makeLog({ sessionId: 'c' }))

      const logs = await service.getRecentLogs(2)
      expect(logs).toHaveLength(2)
    })

    it('should return empty array when no logs exist', async () => {
      const logs = await service.getRecentLogs()
      expect(logs).toEqual([])
    })
  })

  describe('getLastSyncSummary', () => {
    it('should return summary of the most recent log', async () => {
      const expectedSummary: SyncSummary = {
        uploaded: 5,
        downloaded: 2,
        deletedRemote: 1,
        deletedLocal: 0,
        conflicts: 1,
        skipped: 10
      }
      await service.writeLog(
        makeLog({
          sessionId: 'older',
          completedAt: '2026-05-16T00:00:00.000Z',
          summary: {
            uploaded: 9,
            downloaded: 0,
            deletedRemote: 0,
            deletedLocal: 0,
            conflicts: 0,
            skipped: 0
          }
        })
      )
      await service.writeLog(
        makeLog({
          sessionId: 'newer',
          completedAt: '2026-05-17T00:00:00.000Z',
          summary: expectedSummary
        })
      )

      const summary = await service.getLastSyncSummary()
      expect(summary).toEqual(expectedSummary)
    })

    it('should return null when no logs exist', async () => {
      const summary = await service.getLastSyncSummary()
      expect(summary).toBeNull()
    })

    it('should return null for failed sync', async () => {
      await service.writeLog(makeLog({ success: false }))
      const summary = await service.getLastSyncSummary()
      expect(summary).toBeNull()
    })
  })

  describe('getLogCount', () => {
    it('should return the number of log files', async () => {
      expect(await service.getLogCount()).toBe(0)

      await service.writeLog(makeLog({ sessionId: 'a' }))
      await service.writeLog(makeLog({ sessionId: 'b' }))
      expect(await service.getLogCount()).toBe(2)
    })
  })

  describe('cleanupOldLogs', () => {
    it('should keep only the specified number of most recent logs', async () => {
      for (let i = 0; i < 10; i++) {
        await service.writeLog(
          makeLog({
            sessionId: `log-${i}`,
            completedAt: `2026-05-${(10 + i).toString().padStart(2, '0')}T00:00:00.000Z`
          })
        )
      }

      await service.cleanupOldLogs(3)
      const logs = await service.getRecentLogs(20)
      expect(logs).toHaveLength(3)
    })

    it('should do nothing when log count is below keepCount', async () => {
      await service.writeLog(makeLog({ sessionId: 'a' }))
      await service.writeLog(makeLog({ sessionId: 'b' }))

      await service.cleanupOldLogs(5)
      expect(await service.getLogCount()).toBe(2)
    })
  })
})
