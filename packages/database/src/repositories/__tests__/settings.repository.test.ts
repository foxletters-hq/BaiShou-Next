import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { SettingsRepository } from '../settings.repository';
import { systemSettingsTable } from '../../schema/system-settings';
import { 
  DEFAULT_AI_PROVIDERS, DEFAULT_GLOBAL_MODELS, DEFAULT_AGENT_BEHAVIOR, 
  DEFAULT_RAG_CONFIG, DEFAULT_WEB_SEARCH_CONFIG, DEFAULT_SUMMARY_CONFIG, 
  DEFAULT_TOOL_MANAGEMENT_CONFIG, DEFAULT_MCP_SERVER_CONFIG
} from '../settings.defaults';

describe('SettingsRepository', () => {
  let db: any;
  let repo: SettingsRepository;

  beforeEach(() => {
    // 采用内存数据库进行极其干净快速的 TDD 测试
    const sqlite = new Database(':memory:');
    db = drizzle(sqlite);
    
    // 初始化独立表结构
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS system_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);

    repo = new SettingsRepository(db);
  });

  it('should return null for non-existent key', async () => {
    const value = await repo.get('not-exist');
    expect(value).toBeNull();
  });

  it('should save and correctly retrieve complex JSON objects', async () => {
    const mockProviders = [
      { id: 'openai', apiKey: 'sk-123', isEnabled: true },
      { id: 'gemini', apiKey: 'ai-321', isEnabled: false }
    ];

    await repo.set('ai_providers_raw', mockProviders);

    const retrieved = await repo.get<typeof mockProviders>('ai_providers_raw');
    
    expect(retrieved).not.toBeNull();
    expect(retrieved?.length).toBe(2);
    expect(retrieved?.[0].id).toBe('openai');
    expect(retrieved?.[0].apiKey).toBe('sk-123');
    expect(retrieved?.[0].isEnabled).toBe(true);
  });

  it('should upsert existing key instead of throwing duplication error', async () => {
    const initialConfig = { theme: 'dark' };
    await repo.set('app_config', initialConfig);
    
    const updatedConfig = { theme: 'light' };
    await repo.set('app_config', updatedConfig);
    
    const retrieved = await repo.get<typeof initialConfig>('app_config');
    expect(retrieved?.theme).toBe('light');
  });

  it('should delete keys successfully', async () => {
    await repo.set('temp_key', { a: 1 });
    await repo.delete('temp_key');
    const retrieved = await repo.get('temp_key');
    expect(retrieved).toBeNull();
  });

  it('should handle JSON parse errors gracefully and return null', async () => {
    // 直接模拟注入坏死的非 JSON 数据
    await db.insert(systemSettingsTable).values({
      key: 'corrupted',
      value: '{bad_json',
      updatedAt: new Date()
    });

    const value = await repo.get('corrupted');
    expect(value).toBeNull();
  });

  describe('Domain Config Blocks', () => {
    it('should return default fallback when no records in db (AI providers & Agent Behavior)', async () => {
      const providers = await repo.getAIProviderConfigs();
      expect(providers).toEqual(DEFAULT_AI_PROVIDERS);
      expect(providers.length).toBeGreaterThan(10); // 原版内置 13 个

      const agentBehavior = await repo.getAgentBehaviorConfig();
      expect(agentBehavior).toEqual(DEFAULT_AGENT_BEHAVIOR);

      const ragConfig = await repo.getRagConfig();
      expect(ragConfig).toEqual(DEFAULT_RAG_CONFIG);
    });

    it('should correctly store and fetch domain configs independently', async () => {
      // Agent Behavior
      const customBehavior = { ...DEFAULT_AGENT_BEHAVIOR, agentContextWindowSize: 50 };
      await repo.setAgentBehaviorConfig(customBehavior);

      const retrievedBehavior = await repo.getAgentBehaviorConfig();
      expect(retrievedBehavior.agentContextWindowSize).toBe(50);
      expect(retrievedBehavior.agentPersona).toBe(DEFAULT_AGENT_BEHAVIOR.agentPersona);
      
      // RAG Config
      const customRag = { ...DEFAULT_RAG_CONFIG, ragTopK: 100 };
      await repo.setRagConfig(customRag);
      
      const retrievedRag = await repo.getRagConfig();
      expect(retrievedRag.ragTopK).toBe(100);

      // Web Search Config
      const customSearch = { ...DEFAULT_WEB_SEARCH_CONFIG, webSearchEngine: 'tavily' };
      await repo.setWebSearchConfig(customSearch);

      const retrievedSearch = await repo.getWebSearchConfig();
      expect(retrievedSearch.webSearchEngine).toBe('tavily');

      // 确保存储项不相互覆盖
      const behaviorAgain = await repo.getAgentBehaviorConfig();
      expect(behaviorAgain.agentContextWindowSize).toBe(50);
    });
  });
});
