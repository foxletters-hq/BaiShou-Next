import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as fsp from 'fs/promises'
import * as fs from 'fs'
import * as path from 'path'
import extract from 'extract-zip'
import {
  initNodeDatabase,
  installDatabaseSchema,
  systemSettingsTable,
  agentAssistantsTable,
  agentSessionsTable,
  agentMessagesTable,
  agentPartsTable,
  summariesTable,
  executeRawSql
} from '@baishou/database-desktop'
import { isBetterSqlite3Available } from './better-sqlite3-available'

const mockTempDir = path.join(__dirname, '.temp-full-archive-test')
const mockUserData = path.join(mockTempDir, 'userData')
const mockVaultRoot = path.join(mockTempDir, 'vault')

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn((name) => {
      if (name === 'userData') return mockUserData
      if (name === 'temp') return mockTempDir
      return mockTempDir
    }),
    getVersion: vi.fn(() => '4.0.0-test')
  },
  dialog: { showSaveDialog: vi.fn(), showOpenDialog: vi.fn() }
}))

let realDbInstance: any

vi.mock('../db', () => ({
  getAppDb: vi.fn(() => realDbInstance)
}))

import { DesktopArchiveService } from '../archive.service'

describe.skipIf(!isBetterSqlite3Available())('Real Database Full Data Export Extraction', () => {
  let service: DesktopArchiveService
  let mockPathService: any
  let mockVaultService: any

  beforeEach(async () => {
    vi.resetModules()

    if (fs.existsSync(mockTempDir)) {
      await fsp.rm(mockTempDir, { recursive: true, force: true })
    }
    await fsp.mkdir(mockTempDir, { recursive: true })
    await fsp.mkdir(mockUserData, { recursive: true })
    await fsp.mkdir(mockVaultRoot, { recursive: true })

    const agentDbPath = path.join(mockUserData, 'baishou_agent.db')
    realDbInstance = initNodeDatabase(agentDbPath)
    await installDatabaseSchema(realDbInstance)

    await realDbInstance.insert(systemSettingsTable).values({
      key: 'user_profile_data',
      value: JSON.stringify({ nickname: '超级白守测试员' }),
      updatedAt: new Date('2023-01-01')
    })

    await realDbInstance.insert(agentAssistantsTable).values({
      id: 'assistant-123',
      name: '超级专属秘书',
      createdAt: new Date('2023-01-01'),
      updatedAt: new Date('2023-01-01')
    })

    await realDbInstance.insert(agentSessionsTable).values({
      id: 'session-1',
      assistantId: 'assistant-123',
      vaultName: 'default',
      providerId: 'openai',
      modelId: 'gpt-4',
      createdAt: new Date('2023-01-01'),
      updatedAt: new Date('2023-01-01')
    })

    await realDbInstance.insert(agentMessagesTable).values({
      id: 'msg-1',
      sessionId: 'session-1',
      role: 'user',
      orderIndex: 0,
      createdAt: new Date('2023-01-01')
    })

    await realDbInstance.insert(agentPartsTable).values({
      id: 'part-1',
      messageId: 'msg-1',
      sessionId: 'session-1',
      type: 'text',
      data: '你好，我是白守，我会把你打包走',
      createdAt: new Date('2023-01-01')
    })

    await realDbInstance.insert(summariesTable).values({
      type: 'weekly',
      startDate: new Date('2023-01-01'),
      endDate: new Date('2023-01-07'),
      content: '这是一条测试回忆录',
      generatedAt: new Date('2023-01-01')
    })

    await fsp.mkdir(path.join(mockVaultRoot, 'avatars'), { recursive: true })
    await fsp.writeFile(
      path.join(mockVaultRoot, 'avatars', 'avatar.png'),
      'real-avatar-binary-data'
    )
    await fsp.writeFile(
      path.join(mockVaultRoot, '2026-04-12.md'),
      '# 我今天的日记内容，真实存在磁盘中'
    )
    await fsp.mkdir(path.join(mockVaultRoot, '.baishou'), { recursive: true })
    await fsp.writeFile(
      path.join(mockVaultRoot, '.baishou', 'shadow_index.db'),
      'physical-shadow-db-file'
    )

    mockPathService = { getRootDirectory: vi.fn().mockResolvedValue(mockVaultRoot) }
    mockVaultService = { initRegistry: vi.fn().mockResolvedValue(true) }
    service = new DesktopArchiveService(mockPathService, mockVaultService)
  })

  afterEach(async () => {
    if (fs.existsSync(mockTempDir)) {
      await fsp.rm(mockTempDir, { recursive: true, force: true }).catch(() => {})
    }
  })

  it('should physically export the SQLite database and allow raw extraction and query', async () => {
    const zipPath = await service.exportToTempFile()
    expect(zipPath).toBeTruthy()

    const extractDir = path.join(mockTempDir, 'extracted')
    await fsp.mkdir(extractDir, { recursive: true })

    await extract(zipPath!, { dir: extractDir })

    expect(fs.existsSync(path.join(extractDir, 'avatars', 'avatar.png'))).toBe(true)
    expect(fs.readFileSync(path.join(extractDir, '2026-04-12.md'), 'utf-8')).toContain('日记内容')

    const extractedDbPath = path.join(extractDir, 'database', 'baishou_agent.db')
    expect(fs.existsSync(extractedDbPath)).toBe(true)

    const extractedDb = initNodeDatabase(extractedDbPath)
    const client = (extractedDb as any).session.client

    const settingsRes = await executeRawSql(client, 'SELECT * FROM system_settings')
    expect(settingsRes.rows[0].value).toContain('超级白守测试员')

    const assistantsRes = await executeRawSql(client, 'SELECT * FROM agent_assistants')
    expect(assistantsRes.rows[0].name).toBe('超级专属秘书')

    const msgRes = await executeRawSql(client, 'SELECT data FROM agent_parts')
    expect(String(msgRes.rows[0].data)).toContain('我会把你打包走')

    const memRes = await executeRawSql(client, 'SELECT * FROM summaries')
    expect(memRes.rows[0].content).toContain('这是一条测试回忆录')
  })
})
