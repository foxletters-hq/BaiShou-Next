import { describe, it, expect, beforeEach, vi } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { logger } from '@baishou/shared'
import { SettingsRepository } from '../settings.repository'
import { DEFAULT_PROFILE, UserProfileRepository } from '../user-profile.repository'
import { systemSettingsTable } from '../../schema/system-settings'
import {
  DEFAULT_AI_PROVIDERS,
  DEFAULT_AGENT_BEHAVIOR,
  DEFAULT_RAG_CONFIG,
  DEFAULT_WEB_SEARCH_CONFIG
} from '../settings.defaults'

describe('SettingsRepository', () => {
  let db: any
  let repo: SettingsRepository

  beforeEach(() => {
    // 采用内存数据库进行极其干净快速的 TDD 测试
    const sqlite = new Database(':memory:')
    db = drizzle(sqlite)

    // 初始化独立表结构
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS system_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `)

    repo = new SettingsRepository(db)
  })

  it('should return null for non-existent key', async () => {
    const value = await repo.get('not-exist')
    expect(value).toBeNull()
  })

  it('should save and correctly retrieve complex JSON objects', async () => {
    const mockProviders = [
      { id: 'openai', apiKey: 'sk-123', isEnabled: true },
      { id: 'gemini', apiKey: 'ai-321', isEnabled: false }
    ]

    await repo.set('ai_providers_raw', mockProviders)

    const retrieved = await repo.get<typeof mockProviders>('ai_providers_raw')

    expect(retrieved).not.toBeNull()
    expect(retrieved?.length).toBe(2)
    expect(retrieved![0]!.id).toBe('openai')
    expect(retrieved![0]!.apiKey).toBe('sk-123')
    expect(retrieved![0]!.isEnabled).toBe(true)
  })

  it('should upsert existing key instead of throwing duplication error', async () => {
    const initialConfig = { theme: 'dark' }
    await repo.set('app_config', initialConfig)

    const updatedConfig = { theme: 'light' }
    await repo.set('app_config', updatedConfig)

    const retrieved = await repo.get<typeof initialConfig>('app_config')
    expect(retrieved?.theme).toBe('light')
  })

  it('should delete keys successfully', async () => {
    await repo.set('temp_key', { a: 1 })
    await repo.delete('temp_key')
    const retrieved = await repo.get('temp_key')
    expect(retrieved).toBeNull()
  })

  it('should handle JSON parse errors gracefully and return null', async () => {
    // 直接模拟注入坏死的非 JSON 数据
    await db.insert(systemSettingsTable).values({
      key: 'corrupted',
      value: '{bad_json',
      updatedAt: new Date()
    })

    const value = await repo.get('corrupted')
    expect(value).toBeNull()
  })

  describe('Domain Config Blocks', () => {
    it('should return default fallback when no records in db (AI providers & Agent Behavior)', async () => {
      const providers = await repo.getAIProviderConfigs()
      expect(providers).toEqual(DEFAULT_AI_PROVIDERS)
      expect(providers.length).toBeGreaterThan(10) // 原版内置 13 个

      const agentBehavior = await repo.getAgentBehaviorConfig()
      expect(agentBehavior).toEqual(DEFAULT_AGENT_BEHAVIOR)

      const ragConfig = await repo.getRagConfig()
      expect(ragConfig).toEqual(DEFAULT_RAG_CONFIG)
    })

    it('should correctly store and fetch domain configs independently', async () => {
      // Agent Behavior
      const customBehavior = {
        ...DEFAULT_AGENT_BEHAVIOR,
        agentContextWindowSize: 50
      }
      await repo.setAgentBehaviorConfig(customBehavior)

      const retrievedBehavior = await repo.getAgentBehaviorConfig()
      expect(retrievedBehavior.agentContextWindowSize).toBe(50)
      expect(retrievedBehavior.agentPersona).toBe(DEFAULT_AGENT_BEHAVIOR.agentPersona)

      // RAG Config
      const customRag = { ...DEFAULT_RAG_CONFIG, ragTopK: 100 }
      await repo.setRagConfig(customRag)

      const retrievedRag = await repo.getRagConfig()
      expect(retrievedRag.ragTopK).toBe(100)

      // Web Search Config
      const customSearch = {
        ...DEFAULT_WEB_SEARCH_CONFIG,
        webSearchEngine: 'tavily'
      }
      await repo.setWebSearchConfig(customSearch)

      const retrievedSearch = await repo.getWebSearchConfig()
      expect(retrievedSearch.webSearchEngine).toBe('tavily')

      // 确保存储项不相互覆盖
      const behaviorAgain = await repo.getAgentBehaviorConfig()
      expect(behaviorAgain.agentContextWindowSize).toBe(50)
    })
  })

  describe('Write-Through Read Cache', () => {
    it('should serve cached value without hitting db again and isolate returned object references', async () => {
      await repo.set('cached_obj', { nested: { count: 1 } })
      const selectSpy = vi.spyOn(db, 'select')

      const first = await repo.get<{ nested: { count: number } }>('cached_obj')
      expect(first).toEqual({ nested: { count: 1 } })
      expect(selectSpy).not.toHaveBeenCalled()

      // 篡改返回对象不能污染缓存内 JSON 字符串
      first!.nested.count = 999
      const second = await repo.get<{ nested: { count: number } }>('cached_obj')
      expect(second).toEqual({ nested: { count: 1 } })
      expect(selectSpy).not.toHaveBeenCalled()
    })

    it('should cache null results to prevent repeated db reads for missing keys', async () => {
      const selectSpy = vi.spyOn(db, 'select')

      expect(await repo.get('prompt_shortcuts_v2')).toBeNull()
      expect(selectSpy).toHaveBeenCalledTimes(1)

      expect(await repo.get('prompt_shortcuts_v2')).toBeNull()
      expect(await repo.get('prompt_shortcuts_v2')).toBeNull()
      expect(selectSpy).toHaveBeenCalledTimes(1)
    })

    it('should update cache on set and delete', async () => {
      const selectSpy = vi.spyOn(db, 'select')

      expect(await repo.get('dynamic_key')).toBeNull()
      expect(selectSpy).toHaveBeenCalledTimes(1)

      await repo.set('dynamic_key', { v: 1 })
      expect(await repo.get<{ v: number }>('dynamic_key')).toEqual({ v: 1 })
      expect(selectSpy).toHaveBeenCalledTimes(1)

      await repo.delete('dynamic_key')
      expect(await repo.get('dynamic_key')).toBeNull()
      expect(selectSpy).toHaveBeenCalledTimes(1)
    })

    it('should prewarm cache on getAll and re-read from db after invalidateCache', async () => {
      await db.insert(systemSettingsTable).values([
        { key: 'k1', value: JSON.stringify({ a: 1 }), updatedAt: new Date() },
        { key: 'k2', value: JSON.stringify('hello'), updatedAt: new Date() }
      ])

      const selectSpy = vi.spyOn(db, 'select')
      const all = await repo.getAll()
      expect(all).toEqual({ k1: { a: 1 }, k2: 'hello' })
      expect(selectSpy).toHaveBeenCalledTimes(1)

      expect(await repo.get<{ a: number }>('k1')).toEqual({ a: 1 })
      expect(await repo.get<string>('k2')).toBe('hello')
      expect(selectSpy).toHaveBeenCalledTimes(1)

      // 单键失效只清该键
      repo.invalidateCache('k1')
      expect(await repo.get<{ a: number }>('k1')).toEqual({ a: 1 })
      expect(selectSpy).toHaveBeenCalledTimes(2)
      expect(await repo.get<string>('k2')).toBe('hello')
      expect(selectSpy).toHaveBeenCalledTimes(2)

      // 全量失效后全部重新查库
      repo.invalidateCache()
      expect(await repo.get<string>('k2')).toBe('hello')
      expect(selectSpy).toHaveBeenCalledTimes(3)
    })

    it('should invalidate cached key when UserProfileRepository writes system_settings directly', async () => {
      expect(await repo.get('user_profile_data')).toBeNull()

      const profileRepo = new UserProfileRepository(db)
      await profileRepo.saveProfile({
        ...DEFAULT_PROFILE,
        nickname: 'Alice'
      })

      const fresh = await repo.get<{ nickname: string }>('user_profile_data')
      expect(fresh?.nickname).toBe('Alice')
    })

    it('should log slow get diagnostic breakdown only when sqlMs + parseMs >= 500ms', async () => {
      await db.insert(systemSettingsTable).values({
        key: 'ai_providers',
        value: JSON.stringify([{ id: 'openai' }]),
        updatedAt: new Date()
      })

      const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {})
      try {
        // 正常快速读取不输出慢日志
        const fast = await repo.get<Array<{ id: string }>>('ai_providers')
        expect(fast).toEqual([{ id: 'openai' }])
        expect(warnSpy).not.toHaveBeenCalled()

        // 模拟慢读（SQL 耗时 420ms + parse 耗时 120ms = 540ms）
        repo.invalidateCache('ai_providers')
        const timestamps = [1000, 1420, 1420, 1540]
        let idx = 0
        const dateNowSpy = vi.spyOn(Date, 'now').mockImplementation(() => {
          const val = timestamps[Math.min(idx, timestamps.length - 1)]!
          idx += 1
          return val
        })
        try {
          const slow = await repo.get<Array<{ id: string }>>('ai_providers')
          expect(slow).toEqual([{ id: 'openai' }])
          expect(warnSpy).toHaveBeenCalledWith('[SettingsRepo] slow get', {
            key: 'ai_providers',
            sqlMs: 420,
            parseMs: 120,
            bytes: JSON.stringify([{ id: 'openai' }]).length,
            hit: true
          })
        } finally {
          dateNowSpy.mockRestore()
        }
      } finally {
        warnSpy.mockRestore()
      }
    })
  })
})
