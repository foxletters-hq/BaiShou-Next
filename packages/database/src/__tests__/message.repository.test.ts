import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import Database from 'better-sqlite3'
import { MessageRepository } from '../repositories/message.repository'
import { agentMessagesTable } from '../schema/agent-messages'
import { agentPartsTable } from '../schema/agent-parts'
import { FTS_SYNC_TRIGGER_STATEMENTS } from '../schema/fts'

describe('MessageRepository - searchMessagesByKeyword', () => {
  let db: any
  let repo: MessageRepository
  let sqlite: Database.Database

  beforeAll(() => {
    sqlite = new Database(':memory:')
    db = drizzle(sqlite)
    repo = new MessageRepository(db as any)

    // 创建所需的表
    sqlite.exec(`
      CREATE TABLE agent_sessions (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL DEFAULT '新对话',
        vault_name TEXT NOT NULL,
        assistant_id TEXT,
        is_pinned INTEGER NOT NULL DEFAULT 0,
        system_prompt TEXT,
        provider_id TEXT NOT NULL,
        model_id TEXT NOT NULL,
        total_input_tokens INTEGER NOT NULL DEFAULT 0,
        total_output_tokens INTEGER NOT NULL DEFAULT 0,
        total_cost_micros INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
      );

      CREATE TABLE agent_messages (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL,
        is_summary INTEGER NOT NULL DEFAULT 0,
        ask_id TEXT,
        provider_id TEXT,
        model_id TEXT,
        order_index INTEGER NOT NULL,
        input_tokens INTEGER,
        output_tokens INTEGER,
        cost_micros INTEGER,
        created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
      );

      CREATE TABLE agent_parts (
        id TEXT PRIMARY KEY,
        message_id TEXT NOT NULL,
        session_id TEXT NOT NULL,
        type TEXT NOT NULL,
        data TEXT,
        created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
      );
    `)

    // 初始化 FTS
    sqlite.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS agent_messages_fts USING fts5(
        part_id UNINDEXED, 
        message_id UNINDEXED, 
        session_id UNINDEXED, 
        content, 
        tokenize='unicode61'
      );
    `)
    for (const stmt of FTS_SYNC_TRIGGER_STATEMENTS) {
      sqlite.exec(stmt)
    }

    // 插入一个会话
    sqlite.exec(`
      INSERT INTO agent_sessions (id, title, vault_name, provider_id, model_id)
      VALUES ('session-1', '测试会话 1', 'vault-1', 'provider-1', 'model-1')
    `)
  })

  afterAll(() => {
    sqlite.close()
  })

  it('should insert messages and match them via FTS or LIKE', async () => {
    // 1. 插入一条普通文本消息
    const msgId = 'msg-1'
    await db.insert(agentMessagesTable).values({
      id: msgId,
      sessionId: 'session-1',
      role: 'user',
      orderIndex: 1,
      createdAt: new Date()
    })

    await db.insert(agentPartsTable).values({
      id: 'part-1',
      messageId: msgId,
      sessionId: 'session-1',
      type: 'text',
      data: { text: '你好，请帮我写一段代码来搜索历史会话。' },
      createdAt: new Date()
    })

    // 2. 插入一条思考消息（不应该被搜索到）
    const msgId2 = 'msg-2'
    await db.insert(agentMessagesTable).values({
      id: msgId2,
      sessionId: 'session-1',
      role: 'assistant',
      orderIndex: 2,
      createdAt: new Date()
    })

    await db.insert(agentPartsTable).values({
      id: 'part-2',
      messageId: msgId2,
      sessionId: 'session-1',
      type: 'text',
      data: { text: '我想了想，这个代码应该这么写...', isReasoning: true },
      createdAt: new Date()
    })

    // 3. 测试搜索 "代码"
    const results = await repo.searchMessagesByKeyword('代码')
    console.log('Search "代码" results:', JSON.stringify(results, null, 2))
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].content).toContain('代码')

    // 检查 FTS 表
    const ftsRows = sqlite.prepare('SELECT * FROM agent_messages_fts').all()
    console.log('agent_messages_fts rows:', JSON.stringify(ftsRows, null, 2))

    // 检查 SQLite json_extract 对 isReasoning 的解析
    const jsonTest = sqlite
      .prepare(
        `
      SELECT 
        json_extract(data, '$.isReasoning') as val,
        json_type(data, '$.isReasoning') as type,
        (json_extract(data, '$.isReasoning') = 0) as eq_0,
        (json_extract(data, '$.isReasoning') = 'false') as eq_false_str,
        (json_extract(data, '$.isReasoning') = false) as eq_false,
        COALESCE(json_extract(data, '$.isReasoning'), 0) as coalesced
      FROM agent_parts WHERE id = 'part-2'
    `
      )
      .all()
    console.log('jsonTest:', JSON.stringify(jsonTest, null, 2))

    // 4. 测试搜索 "我想了想"（应该搜索不到，因为它是思考消息）
    const results2 = await repo.searchMessagesByKeyword('我想了想')
    console.log('Search "我想了想" results:', JSON.stringify(results2, null, 2))
    expect(results2.length).toBe(0)

    // 5. 插入一条 explicitly has isReasoning: false 的消息
    const msgId3 = 'msg-3'
    await db.insert(agentMessagesTable).values({
      id: msgId3,
      sessionId: 'session-1',
      role: 'user',
      orderIndex: 3,
      createdAt: new Date()
    })

    await db.insert(agentPartsTable).values({
      id: 'part-3',
      messageId: msgId3,
      sessionId: 'session-1',
      type: 'text',
      data: { text: '这是一个显式设置isReasoning为false的消息', isReasoning: false },
      createdAt: new Date()
    })

    // 测试 FTS 路径
    const results3 = await repo.searchMessagesByKeyword('显式')
    console.log('FTS Search "显式" results:', JSON.stringify(results3, null, 2))
    expect(results3.length).toBeGreaterThan(0)

    // 强行欺骗 FTS 路径返回空，以测试 LIKE 路径
    const originalFts = (repo as any).searchMessagesViaFts
    ;(repo as any).searchMessagesViaFts = async () => []

    try {
      const resultsLike = await repo.searchMessagesByKeyword('显式')
      console.log('LIKE Search "显式" results:', JSON.stringify(resultsLike, null, 2))
      expect(resultsLike.length).toBeGreaterThan(0)
      expect(resultsLike[0].content).toContain('显式设置')
    } finally {
      ;(repo as any).searchMessagesViaFts = originalFts
    }
  })

  it('should find sessions by searchQuery matching session title or message content', async () => {
    const { SessionRepository } = await import('../repositories/session.repository')
    const sessionRepo = new SessionRepository(db as any)

    // 1. 根据会话标题查询 "测试会话"
    const s1 = await sessionRepo.findAllSessions(10, 0, undefined, '测试会话')
    expect(s1.length).toBeGreaterThan(0)
    expect(s1[0]!.id).toBe('session-1')

    // 2. 根据消息内容查询 "代码"
    const s2 = await sessionRepo.findAllSessions(10, 0, undefined, '代码')
    expect(s2.length).toBeGreaterThan(0)
    expect(s2[0]!.id).toBe('session-1')

    // 3. 查询不存在的词 "找不到我"
    const s3 = await sessionRepo.findAllSessions(10, 0, undefined, '找不到我')
    expect(s3.length).toBe(0)
  })
})
