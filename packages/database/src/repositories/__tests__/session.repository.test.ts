import { describe, it, expect, beforeAll } from 'vitest';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';

import { SessionRepository } from '../session.repository';
import { agentSessionsTable } from '../../schema/agent-sessions';
import { agentMessagesTable } from '../../schema/agent-messages';
import { agentPartsTable } from '../../schema/agent-parts';

describe('Database: SessionRepository', () => {
  let db: ReturnType<typeof drizzle>;
  let sessionRepo: SessionRepository;

  beforeAll(() => {
    const sqlite = new Database(':memory:');
    db = drizzle(sqlite);
    sessionRepo = new SessionRepository(db);

    // Initialise Memory Tables precisely mimicking Drizzle migrations
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS agent_sessions (
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
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
      );

      CREATE TABLE IF NOT EXISTS agent_messages (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL REFERENCES agent_sessions(id) ON DELETE CASCADE,
        role TEXT NOT NULL,
        is_summary INTEGER NOT NULL DEFAULT 0,
        ask_id TEXT,
        provider_id TEXT,
        model_id TEXT,
        order_index INTEGER NOT NULL,
        input_tokens INTEGER,
        output_tokens INTEGER,
        cost_micros INTEGER,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
      );

      CREATE TABLE IF NOT EXISTS agent_parts (
        id TEXT PRIMARY KEY,
        message_id TEXT NOT NULL REFERENCES agent_messages(id) ON DELETE CASCADE,
        session_id TEXT NOT NULL,
        type TEXT NOT NULL,
        data TEXT,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
      );
    `);
  });

  it('upsertSession should safely insert and then update without collision', async () => {
    // 1. Insert
    await sessionRepo.upsertSession({
      id: 'session-123',
      title: 'Initial Title',
      vaultName: 'vault-x',
      providerId: 'openai.mock',
      modelId: 'gpt-mock'
    });

    let records = await db.select().from(agentSessionsTable);
    expect(records).toHaveLength(1);
    expect(records[0].title).toBe('Initial Title');

    // 2. Upsert collision Update
    await sessionRepo.upsertSession({
      id: 'session-123',
      title: 'Updated Title',
      vaultName: 'vault-x',
      providerId: 'openai.mock',
      modelId: 'gpt-mock'
    });

    records = await db.select().from(agentSessionsTable);
    expect(records).toHaveLength(1); // STILL 1!
    expect(records[0].title).toBe('Updated Title');
  });

  it('insertMessageWithParts performs isolated cascade insert for nested fragments', async () => {
    // Ensure parent session exists
    await sessionRepo.upsertSession({
      id: 'session-cascade',
      vaultName: 'test',
      providerId: 'testp',
      modelId: 'testm'
    });

    // Execute ATOMIC multi-table insertion
    await sessionRepo.insertMessageWithParts({
      id: 'msg-abc',
      sessionId: 'session-cascade',
      role: 'user',
      orderIndex: 0
    }, [
      { id: 'part-1', messageId: 'msg-abc', sessionId: 'session-cascade', type: 'text', data: { text: "Hello part" } },
      { id: 'part-2', messageId: 'msg-abc', sessionId: 'session-cascade', type: 'tool', data: { toolName: "weather" } }
    ]);

    const msgRecs = await db.select().from(agentMessagesTable);
    const prtRecs = await db.select().from(agentPartsTable);
    
    // Asserts 1 parent, 2 children
    expect(msgRecs.find(m => m.id === 'msg-abc')).toBeDefined();
    expect(prtRecs.filter(p => p.messageId === 'msg-abc')).toHaveLength(2);
  });

  it('getMessagesBySession properly queries reversed lists with nested parts mapping (N+1 Flat)', async () => {
    // Reusing 'session-cascade'
    const messages = await sessionRepo.getMessagesBySession('session-cascade', 10);
    
    // Order index descendant -> Array Reversed -> ascending time order
    expect(messages).toHaveLength(1);
    const complexMsg = messages[0];
    
    expect(complexMsg.role).toBe('user');
    expect(complexMsg.parts).toBeDefined();
    expect(complexMsg.parts).toHaveLength(2);
    expect(JSON.parse(complexMsg.parts[0].data as string).text).toBe('Hello part');
  });
});
