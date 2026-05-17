import { describe, it, expect, vi, afterEach } from 'vitest';
import * as fsp from 'fs/promises';
import * as fs from 'fs';
import * as path from 'path';
import { initNodeDatabase } from '@baishou/database';
import { systemSettingsTable, agentSessionsTable, agentMessagesTable } from '@baishou/database';
import { eq } from 'drizzle-orm';
import { LegacyMigrationService } from '../legacy-migration.service';
import { installDatabaseSchema } from '@baishou/database';

const TEST_WORKSPACE = 'd:/Code-Dev/test';
const MOCK_DATA_DIR = path.join(TEST_WORKSPACE, 'cases');

let currentMockUserData = '';
let realDbInstance: any;

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => currentMockUserData)
  }
}));

vi.mock('../db', () => ({
  getAppDb: vi.fn(() => realDbInstance)
}));

describe('LegacyMigrationService Integration Tests', () => {
  let legacyService: LegacyMigrationService;

  const prepareEnv = async (testName: string) => {
    currentMockUserData = path.join(TEST_WORKSPACE, `mock_userData_${testName}`);
    if (fs.existsSync(currentMockUserData)) {
      try { await fsp.rm(currentMockUserData, { recursive: true, force: true }); } catch {}
    }
    await fsp.mkdir(currentMockUserData, { recursive: true });

    const dbPath = path.join(currentMockUserData, 'baishou_agent.db');
    realDbInstance = initNodeDatabase(dbPath);
    await installDatabaseSchema(realDbInstance);
    legacyService = new LegacyMigrationService();
  };

  afterEach(async () => {
    if (realDbInstance && (realDbInstance as any).session?.client) {
      try { await ((realDbInstance as any).session.client as any).close(); } catch {}
    }
  });

  it('Case 1: Fresh legacy install with only config and empty DB', async () => {
    await prepareEnv('case1');
    const caseDir = path.join(MOCK_DATA_DIR, 'case1');
    const targetDir = path.join(currentMockUserData, 'target_workspace');
    
    expect(await legacyService.isLegacyAppRoot(caseDir)).toBe(true);
    await legacyService.migrate(caseDir, targetDir);

    const aiProv = await realDbInstance.select().from(systemSettingsTable).where(eq(systemSettingsTable.key, 'ai_providers')).get();
    expect(aiProv).toBeDefined();
    expect(JSON.parse(aiProv.value as string)).toEqual(["openai"]);
  });

  it('Case 2: Multi-vault structure (Personal, Work) with sessions', async () => {
    await prepareEnv('case2');
    const caseDir = path.join(MOCK_DATA_DIR, 'case2');
    const targetDir = path.join(currentMockUserData, 'target_workspace_c2');
    
    await legacyService.migrate(caseDir, targetDir);

    const sessions = await realDbInstance.select().from(agentSessionsTable).all();
    expect(sessions.length).toBe(2);
    const sessionIds = sessions.map((s: any) => s.id);
    expect(sessionIds).toContain('sess_c2p');
    expect(sessionIds).toContain('sess_c2w');

    expect(fs.existsSync(path.join(targetDir, 'Personal'))).toBe(true);
    expect(fs.existsSync(path.join(targetDir, 'Work'))).toBe(true);
    expect(fs.existsSync(path.join(targetDir, 'Personal', '.baishou', 'agent.sqlite'))).toBe(false);
  });

  it('Case 3: Legacy DB with shadow_index is preserved physically', async () => {
    await prepareEnv('case3');
    const caseDir = path.join(MOCK_DATA_DIR, 'case3');
    const targetDir = path.join(currentMockUserData, 'target_workspace_c3');
    
    await legacyService.migrate(caseDir, targetDir);

    expect(fs.existsSync(path.join(targetDir, 'SecretVault', '.baishou', 'shadow_index.db'))).toBe(true);
  });

  it('Case 4: Avatars are structurally mapped to root UserData', async () => {
    await prepareEnv('case4');
    const caseDir = path.join(MOCK_DATA_DIR, 'case4');
    const targetDir = path.join(currentMockUserData, 'target_workspace_c4');
    
    await legacyService.migrate(caseDir, targetDir);

    expect(fs.existsSync(path.join(currentMockUserData, 'assistant_avatars', 'bot.png'))).toBe(true);
    expect(fs.existsSync(path.join(currentMockUserData, 'user_avatar.png'))).toBe(true);
  });

  it('Case 5: Atomicity backup logic guarantees no partial writes on error', async () => {
    await prepareEnv('case5');
    const caseDir = path.join(MOCK_DATA_DIR, 'case5');
    const targetDir = path.join(currentMockUserData, 'target_workspace_c5');
    
    await expect(legacyService.migrate(caseDir, targetDir)).rejects.toThrow();

    const sessions = await realDbInstance.select().from(agentSessionsTable).all();
    expect(sessions.length).toBe(0);
  });

  const MASSIVE_DATA_DIR = path.join(TEST_WORKSPACE, 'massive_cases');

  it('Case 6 [STRESS TEST]: 30MB+ Database Single Vault Migration', async () => {
    await prepareEnv('case6');
    const caseDir = path.join(MASSIVE_DATA_DIR, 'case6');
    const targetDir = path.join(currentMockUserData, 'target_workspace_c6');
    
    // We expect this massive query (with over thousands of 10KB texts) to execute successfully without maxing out Node V8 memory limits string buffer allocations
    await legacyService.migrate(caseDir, targetDir);

    const sessions = await realDbInstance.select().from(agentSessionsTable).all();
    expect(sessions.length).toBe(10); // As per our massive mock script, 10 sessions were created
    const messages = await realDbInstance.select().from(agentMessagesTable).all();
    expect(messages.length).toBeGreaterThan(2000); // Massive mock script mathematically creates roughly 3000 messages (about 30MB)
    console.log(`[STRESS TEST] Case 6 successfully migrated ${messages.length} mega-messages.`);
  }, 30000); // 30 seconds timeout limit for large I/O

  it('Case 7 [STRESS TEST]: Complex Multi-Vault >60MB Database Migration', async () => {
    await prepareEnv('case7');
    const caseDir = path.join(MASSIVE_DATA_DIR, 'case7');
    const targetDir = path.join(currentMockUserData, 'target_workspace_c7');
    
    await legacyService.migrate(caseDir, targetDir);

    const sessions = await realDbInstance.select().from(agentSessionsTable).all();
    expect(sessions.length).toBe(20); // 10 from Vault Alpha + 10 from Vault Beta
    const messages = await realDbInstance.select().from(agentMessagesTable).all();
    expect(messages.length).toBeGreaterThan(5000); // roughly 60MB total
    console.log(`[STRESS TEST] Case 7 successfully migrated ${messages.length} mega-messages from multi-vaults.`);
  }, 60000); // 60 seconds timeout
});
