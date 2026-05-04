import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fsp from 'fs/promises';
import * as fs from 'fs';
import * as path from 'path';
import archiver from 'archiver';
import extract from 'extract-zip';
import { initNodeDatabase } from '@baishou/database';
import { systemSettingsTable, agentAssistantsTable, agentSessionsTable, agentMessagesTable, summariesTable } from '@baishou/database';

const mockTempDir = path.join(__dirname, '.temp-full-archive-test');
const mockUserData = path.join(mockTempDir, 'userData');
const mockVaultRoot = path.join(mockTempDir, 'vault');

// Provide mocked module resolution BEFORE importing the service
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn((name) => {
      if (name === 'userData') return mockUserData;
      if (name === 'temp') return mockTempDir;
      return mockTempDir;
    })
  },
  dialog: { showSaveDialog: vi.fn(), showOpenDialog: vi.fn() }
}));

let realDbInstance: any;

// Mock db.ts globally to return the REAL instance we create below
vi.mock('../db', () => ({
  getAppDb: vi.fn(() => realDbInstance)
}));

import { DesktopArchiveService } from '../archive.service';

describe('Real Database Full Data Export Extraction', () => {
  let service: DesktopArchiveService;
  let mockPathService: any;
  let mockVaultService: any;

  beforeEach(async () => {
    vi.resetModules();
    
    if (fs.existsSync(mockTempDir)) {
      await fsp.rm(mockTempDir, { recursive: true, force: true });
    }
    await fsp.mkdir(mockTempDir, { recursive: true });
    await fsp.mkdir(mockUserData, { recursive: true });
    await fsp.mkdir(mockVaultRoot, { recursive: true });

    // --- 1. SPIN UP REAL DATABASE IN USERDATA ---
    const agentDbPath = path.join(mockUserData, 'baishou_agent.db');
    realDbInstance = initNodeDatabase(agentDbPath);

    // Populate data inside the actual Database
    // Note: Drizzle ORM requires us to push schema. Because SQL is empty, we must manually create tables since drizzle push isn't running
    // Wait... initNodeDatabase typically doesn't auto-migrate unless we run migrate(). But that might be too complex.
    // Actually, we can just execute the DDL directly here or use `connectionManager` if it auto-migrates.
    // Let's create tables manually via raw execute to simulate existing data.
    
    const client = (realDbInstance as any).$client;
    // Settings Profile
    await client.execute(`CREATE TABLE IF NOT EXISTS system_settings (key TEXT PRIMARY KEY, value TEXT, updated_at TEXT);`);
    await client.execute(`INSERT INTO system_settings (key, value, updated_at) VALUES ('user_profile_data', '{"nickname":"超级白守测试员"}', '2023-01-01');`);
    
    // Assistants
    await client.execute(`CREATE TABLE IF NOT EXISTS agent_assistants (id TEXT PRIMARY KEY, name TEXT, updated_at TEXT);`);
    await client.execute(`INSERT INTO agent_assistants (id, name, updated_at) VALUES ('assistant-123', '超级专属秘书', '2023-01-01');`);

    // Sessions and Messages
    await client.execute(`CREATE TABLE IF NOT EXISTS agent_sessions (id TEXT PRIMARY KEY, assistant_id TEXT NOT NULL, created_at TEXT);`);
    await client.execute(`INSERT INTO agent_sessions (id, assistant_id, created_at) VALUES ('session-1', 'assistant-123', '2023-01-01');`);
    
    await client.execute(`CREATE TABLE IF NOT EXISTS agent_messages (id TEXT PRIMARY KEY, session_id TEXT NOT NULL, text TEXT);`);
    await client.execute(`INSERT INTO agent_messages (id, session_id, text) VALUES ('msg-1', 'session-1', '你好，我是白守，我会把你打包走');`);

    // Summaries (Memories)
    await client.execute(`CREATE TABLE IF NOT EXISTS summaries (id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT, content TEXT);`);
    await client.execute(`INSERT INTO summaries (id, type, content) VALUES (1, 'weekly', '这是一条测试回忆录');`);

    // --- 2. CREATE FILES IN VAULT ---
    await fsp.mkdir(path.join(mockVaultRoot, 'avatars'), { recursive: true });
    await fsp.writeFile(path.join(mockVaultRoot, 'avatars', 'avatar.png'), 'real-avatar-binary-data');
    await fsp.writeFile(path.join(mockVaultRoot, '2026-04-12.md'), '# 我今天的日记内容，真实存在磁盘中');
    await fsp.mkdir(path.join(mockVaultRoot, '.baishou'), { recursive: true });
    await fsp.writeFile(path.join(mockVaultRoot, '.baishou', 'shadow_index.db'), 'physical-shadow-db-file');

    mockPathService = { getRootDirectory: vi.fn().mockResolvedValue(mockVaultRoot) };
    mockVaultService = { initRegistry: vi.fn().mockResolvedValue(true) };
    service = new DesktopArchiveService(mockPathService, mockVaultService);
  });

  afterEach(async () => {
    if (fs.existsSync(mockTempDir)) {
      await fsp.rm(mockTempDir, { recursive: true, force: true }).catch(() => {});
    }
  });

  it('should physically export the SQLite database and allow raw extraction and query', async () => {
    // RUN EXPORT
    const zipPath = await service.exportToTempFile();
    expect(zipPath).toBeTruthy();

    const extractDir = path.join(mockTempDir, 'extracted');
    await fsp.mkdir(extractDir, { recursive: true });
    
    // UNZIP
    await extract(zipPath!, { dir: extractDir });

    // ASSERT FILES EXIST
    expect(fs.existsSync(path.join(extractDir, 'avatars', 'avatar.png'))).toBe(true);
    expect(fs.readFileSync(path.join(extractDir, '2026-04-12.md'), 'utf-8')).toContain('日记内容');

    // ASSERT DB EXTRACTED
    const extractedDbPath = path.join(extractDir, 'database', 'baishou_agent.db');
    expect(fs.existsSync(extractedDbPath)).toBe(true);

    // OPEN EXTRACTED DATABASE IN MEMORY AND QUERY IT
    const extractedDb = initNodeDatabase(extractedDbPath);
    const extractedClient = (extractedDb as any).session.client;
    
    const settingsRes = await extractedClient.execute('SELECT * FROM system_settings');
    console.log('[PROVE] Extracted System Settings (Profiles):', settingsRes.rows);
    expect(settingsRes.rows[0].value).toContain('超级白守测试员');

    const assistantsRes = await extractedClient.execute('SELECT * FROM agent_assistants');
    console.log('[PROVE] Extracted Assistants:', assistantsRes.rows);
    expect(assistantsRes.rows[0].name).toBe('超级专属秘书');

    const msgRes = await extractedClient.execute('SELECT * FROM agent_messages');
    console.log('[PROVE] Extracted Chat History:', msgRes.rows);
    expect(msgRes.rows[0].text).toContain('我会把你打包走');

    const memRes = await extractedClient.execute('SELECT * FROM summaries');
    console.log('[PROVE] Extracted Memories:', memRes.rows);
    expect(memRes.rows[0].content).toContain('这是一条测试回忆录');
  });
});
