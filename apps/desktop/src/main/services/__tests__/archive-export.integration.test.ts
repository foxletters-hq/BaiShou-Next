import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fsp from 'fs/promises';
import * as fs from 'fs';
import * as path from 'path';
import archiver from 'archiver';
import extract from 'extract-zip';

const mockTempDir = path.join(__dirname, '.temp-archive-test');
const mockUserData = path.join(mockTempDir, 'userData');
const mockVaultRoot = path.join(mockTempDir, 'vault');

// ======================= MOCKS ==========================
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

// We need an actual appDb logic to test if db is packaged. But to avoid dealing with Drizzle/sqlite native bindings inside vitest easily,
// we can simulate the physical files that the archiving logic expects.
// Because DesktopArchiveService only reads physical files:
// 1. rootDir content
// 2. userData/baishou_next_agent.db  (Wait, db.ts uses baishou_agent.db)
// 3. SettingsRepository

const fakeSettingsRepo = {
  get: vi.fn((key) => {
    if (key === 'ai_providers') return [{ id: 'test-provider' }];
    if (key === 'global_models') return { defaultModel: 'gpt-4' };
    if (key === 'feature_settings') return { enableX: true };
    return null;
  }),
  set: vi.fn(),
};

vi.mock('@baishou/database', () => {
  return {
    connectionManager: { disconnect: vi.fn() },
    SettingsRepository: class {
      get(key: string) { return fakeSettingsRepo.get(key); }
      set(key: string, val: any) { return fakeSettingsRepo.set(key, val); }
    },
    initNodeDatabase: vi.fn(),
  };
});

vi.mock('../db', () => ({
  getAppDb: vi.fn().mockReturnValue({})
}));

// ========================================================
import { DesktopArchiveService } from '../archive.service';

describe('DesktopArchiveService Integration Test', () => {
  let service: DesktopArchiveService;
  let mockPathService: any;
  let mockVaultService: any;

  beforeEach(async () => {
    if (fs.existsSync(mockTempDir)) {
      await fsp.rm(mockTempDir, { recursive: true, force: true });
    }
    await fsp.mkdir(mockTempDir, { recursive: true });
    await fsp.mkdir(mockUserData, { recursive: true });
    await fsp.mkdir(mockVaultRoot, { recursive: true });

    // Populate fake Vault directory
    await fsp.mkdir(path.join(mockVaultRoot, 'avatars'), { recursive: true });
    await fsp.writeFile(path.join(mockVaultRoot, 'avatars', 'avatar.png'), 'fake-image-data');
    await fsp.mkdir(path.join(mockVaultRoot, '.baishou'), { recursive: true });
    await fsp.writeFile(path.join(mockVaultRoot, '.baishou', 'shadow_index.db'), 'fake-shadow-index');
    await fsp.writeFile(path.join(mockVaultRoot, '2026-04-12.md'), '# 今天的天气真好');

    // Create the SQLite database the exporter expects
    // Wait, let's see which name it tries to export.
    await fsp.writeFile(path.join(mockUserData, 'baishou_next_agent.db'), 'fake-sqlite-database-content');
    
    // BUT what about baishou_agent.db which is what db.ts actually creates?
    await fsp.writeFile(path.join(mockUserData, 'baishou_agent.db'), 'fake-sqlite-database-content');

    mockPathService = { getRootDirectory: vi.fn().mockResolvedValue(mockVaultRoot) };
    mockVaultService = { initRegistry: vi.fn().mockResolvedValue(true) };
    service = new DesktopArchiveService(mockPathService, mockVaultService);
  });

  afterEach(async () => {
    if (fs.existsSync(mockTempDir)) {
      await fsp.rm(mockTempDir, { recursive: true, force: true });
    }
  });

  it('should export successfully and contain all required user data', async () => {
    const zipPath = await service.exportToTempFile();
    expect(zipPath).toBeTruthy();
    expect(fs.existsSync(zipPath!)).toBe(true);

    const extractDir = path.join(mockTempDir, 'extracted');
    await fsp.mkdir(extractDir, { recursive: true });
    
    await extract(zipPath!, { dir: extractDir });

    // Verify extracted physical contents
    const avatarsDir = path.join(extractDir, 'avatars');
    expect(fs.existsSync(path.join(avatarsDir, 'avatar.png'))).toBe(true);

    const shadowIndex = path.join(extractDir, '.baishou', 'shadow_index.db');
    expect(fs.existsSync(shadowIndex)).toBe(true);

    const diary = path.join(extractDir, '2026-04-12.md');
    expect(fs.existsSync(diary)).toBe(true);

    // Verify settings were exported
    const settingsPath = path.join(extractDir, 'config', 'device_preferences.json');
    expect(fs.existsSync(settingsPath)).toBe(true, "Config JSON is missing!");
    const settingsJson = JSON.parse(await fsp.readFile(settingsPath, 'utf8'));
    expect(settingsJson.ai_providers[0].id).toBe('test-provider');

    // Verify database is packaged
    const packagedDb = path.join(extractDir, 'database', 'baishou_agent.db');
    expect(fs.existsSync(packagedDb)).toBe(true, "Main Agent SQLite Database was not packed!");
  });
});
