import fs from 'node:fs/promises'
import path from 'node:path'
import Database from 'better-sqlite3'

/** 测试用：模拟 bs-v3 纯文件工作区（含 registry、日记、Archives、空 Vault） */
export async function writeBsV3Fixture(root: string): Promise<void> {
  await fs.mkdir(path.join(root, 'Personal', 'Journals'), { recursive: true })
  await fs.mkdir(path.join(root, 'Personal', 'Archives'), { recursive: true })
  await fs.mkdir(path.join(root, '工作'), { recursive: true })
  await fs.mkdir(path.join(root, '.baishou'), { recursive: true })
  await fs.mkdir(path.join(root, 'config'), { recursive: true })

  await fs.writeFile(
    path.join(root, 'Personal', 'Journals', '2024-06-01.md'),
    '# Morning diary\n\ncontent A'
  )
  await fs.writeFile(
    path.join(root, 'Personal', 'Journals', 'note.md'),
    '---\ndate: 2024-06-01\n---\n# Evening\n\ncontent B'
  )
  await fs.writeFile(path.join(root, 'Personal', 'Archives', 'note.md'), '# archived note')
  await fs.writeFile(
    path.join(root, '.baishou', 'vault_registry.json'),
    JSON.stringify([{ name: 'Personal' }, { name: '工作' }])
  )
}

export async function writeSourceSharedPreferences(
  root: string,
  personas: Record<string, Record<string, string>>
): Promise<void> {
  await fs.mkdir(path.join(root, 'config'), { recursive: true })
  await fs.writeFile(
    path.join(root, 'config', 'shared_preferences.json'),
    JSON.stringify({
      'flutter.user_personas': JSON.stringify(personas)
    })
  )
}

export async function writeSourceDevicePreferences(
  root: string,
  config: Record<string, unknown>
): Promise<void> {
  await fs.mkdir(path.join(root, 'config'), { recursive: true })
  await fs.writeFile(path.join(root, 'config', 'device_preferences.json'), JSON.stringify(config))
}

export async function writeSourceAvatar(root: string, ext: 'jpg' | 'png' = 'jpg'): Promise<void> {
  await fs.mkdir(path.join(root, 'config'), { recursive: true })
  await fs.writeFile(path.join(root, 'config', `avatar.${ext}`), 'fake-avatar-bytes')
}

function createLegacyAgentSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE agent_assistants (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      emoji TEXT,
      description TEXT,
      avatar_path TEXT,
      system_prompt TEXT,
      is_default INTEGER DEFAULT 0,
      context_window INTEGER DEFAULT 20,
      provider_id TEXT,
      model_id TEXT,
      compress_token_threshold INTEGER DEFAULT 60000,
      compress_keep_turns INTEGER DEFAULT 3,
      sort_order INTEGER DEFAULT 0
    );
    CREATE TABLE agent_sessions (
      id TEXT PRIMARY KEY,
      title TEXT,
      vault_name TEXT,
      assistant_id TEXT,
      is_pinned INTEGER DEFAULT 0,
      system_prompt TEXT,
      provider_id TEXT DEFAULT 'openai',
      model_id TEXT DEFAULT 'gpt-4'
    );
    CREATE TABLE agent_messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      role TEXT,
      order_index INTEGER,
      is_summary INTEGER DEFAULT 0,
      ask_id TEXT,
      provider_id TEXT,
      model_id TEXT,
      input_tokens INTEGER,
      output_tokens INTEGER,
      cost_micros INTEGER
    );
    CREATE TABLE agent_parts (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      message_id TEXT NOT NULL,
      type TEXT,
      data TEXT
    );
  `)
}

/** 在 Vault 下写入 agent.sqlite（含 1 伙伴 + 1 会话 + 1 消息） */
export async function writeLegacyAgentDb(
  root: string,
  vaultName = 'Personal',
  options?: { assistantId?: string; sessionId?: string; messageId?: string }
): Promise<{ assistantId: string; sessionId: string; messageId: string }> {
  const assistantId = options?.assistantId ?? 'legacy-ast-1'
  const sessionId = options?.sessionId ?? 'legacy-sess-1'
  const messageId = options?.messageId ?? 'legacy-msg-1'

  const dbDir = path.join(root, vaultName, '.baishou')
  await fs.mkdir(dbDir, { recursive: true })
  const dbPath = path.join(dbDir, 'agent.sqlite')
  const db = new Database(dbPath)
  try {
    createLegacyAgentSchema(db)
    db.prepare(
      `INSERT INTO agent_assistants (id, name, is_default, provider_id, model_id)
       VALUES (?, '测试伙伴', 0, 'openai', 'gpt-4')`
    ).run(assistantId)
    db.prepare(
      `INSERT INTO agent_sessions (id, title, vault_name, assistant_id, provider_id, model_id)
       VALUES (?, '测试会话', ?, ?, 'openai', 'gpt-4')`
    ).run(sessionId, vaultName, assistantId)
    db.prepare(
      `INSERT INTO agent_messages (id, session_id, role, order_index, is_summary)
       VALUES (?, ?, 'user', 0, 0)`
    ).run(messageId, sessionId)
    db.prepare(
      `INSERT INTO agent_parts (id, session_id, message_id, type, data)
       VALUES ('part-1', ?, ?, 'text', '{"text":"hello"}')`
    ).run(sessionId, messageId)
  } finally {
    db.close()
  }

  return { assistantId, sessionId, messageId }
}
