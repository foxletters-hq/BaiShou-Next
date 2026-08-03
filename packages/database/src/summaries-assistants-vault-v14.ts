/**
 * 仓库隔离 V1.4：summaries / agent_assistants 加 vault_id，
 * 重建 summaries 唯一索引，必要时重建 assistants 复合主键。
 *
 * 存量行无仓库线索：fail-closed 删除空 vault_id，交给冷启动全仓磁盘重建灌回。
 */
import {
  SUMMARIES_LEGACY_UNIQUE_INDEX_NAME,
  SUMMARIES_VAULT_UNIQUE_INDEX_SQL
} from './agent-schema-compat'

export type SqlExec = (
  sql: string,
  args?: Array<string | number | null>
) => Promise<{ rows: unknown[]; rowsAffected?: number }>

async function tableExists(exec: SqlExec, table: string): Promise<boolean> {
  const res = await exec(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`, [table])
  return res.rows.length > 0
}

async function columnNames(exec: SqlExec, table: string): Promise<Set<string>> {
  const info = await exec(`PRAGMA table_info(${table})`)
  return new Set(
    info.rows
      .map((r) => String((r as { name?: unknown }).name ?? ''))
      .filter((n) => n.length > 0)
  )
}

async function pkColumns(exec: SqlExec, table: string): Promise<string[]> {
  const info = await exec(`PRAGMA table_info(${table})`)
  return info.rows
    .map((r) => r as { name?: unknown; pk?: unknown })
    .filter((r) => Number(r.pk ?? 0) > 0)
    .sort((a, b) => Number(a.pk) - Number(b.pk))
    .map((r) => String(r.name ?? ''))
    .filter(Boolean)
}

/**
 * 确保 summaries.vault_id 唯一约束正确，并清掉无法归属的行。
 */
export async function ensureSummariesVaultIsolation(exec: SqlExec): Promise<{
  droppedLegacyIndex: boolean
  deletedOrphans: number
}> {
  if (!(await tableExists(exec, 'summaries'))) {
    return { droppedLegacyIndex: false, deletedOrphans: 0 }
  }

  const cols = await columnNames(exec, 'summaries')
  if (!cols.has('vault_id')) {
    await exec(`ALTER TABLE summaries ADD COLUMN vault_id TEXT`)
  }

  await exec(`DROP INDEX IF EXISTS ${SUMMARIES_LEGACY_UNIQUE_INDEX_NAME}`)
  // drizzle 旧名也可能是带表前缀的自动名
  await exec(`DROP INDEX IF EXISTS summaries_type_start_date_end_date_unique`)
  await exec(SUMMARIES_VAULT_UNIQUE_INDEX_SQL)

  const del = await exec(
    `DELETE FROM summaries WHERE vault_id IS NULL OR TRIM(vault_id) = ''`
  )

  return {
    droppedLegacyIndex: true,
    deletedOrphans: Number(del.rowsAffected ?? 0)
  }
}

/**
 * 确保 agent_assistants 以 (vault_id, id) 为复合主键，并清掉无法归属的行。
 */
export async function ensureAssistantsVaultIsolation(exec: SqlExec): Promise<{
  rebuiltPk: boolean
  deletedOrphans: number
}> {
  if (!(await tableExists(exec, 'agent_assistants'))) {
    return { rebuiltPk: false, deletedOrphans: 0 }
  }

  const cols = await columnNames(exec, 'agent_assistants')
  if (!cols.has('vault_id')) {
    await exec(`ALTER TABLE agent_assistants ADD COLUMN vault_id TEXT`)
  }

  const del = await exec(
    `DELETE FROM agent_assistants WHERE vault_id IS NULL OR TRIM(vault_id) = ''`
  )
  const deletedOrphans = Number(del.rowsAffected ?? 0)

  const pk = await pkColumns(exec, 'agent_assistants')
  const hasComposite =
    pk.length === 2 && pk.includes('vault_id') && pk.includes('id')
  if (hasComposite) {
    return { rebuiltPk: false, deletedOrphans }
  }

  // SQLite 无法 ALTER PRIMARY KEY：整表重建
  await exec(`
    CREATE TABLE agent_assistants__v14 (
      id TEXT NOT NULL,
      vault_id TEXT NOT NULL,
      name TEXT NOT NULL,
      emoji TEXT,
      description TEXT DEFAULT '',
      avatar_path TEXT,
      system_prompt TEXT DEFAULT '',
      is_default INTEGER NOT NULL DEFAULT 0,
      is_pinned INTEGER NOT NULL DEFAULT 0,
      context_window INTEGER NOT NULL DEFAULT -1,
      provider_id TEXT,
      model_id TEXT,
      compress_token_threshold INTEGER NOT NULL DEFAULT 150000,
      compress_keep_turns INTEGER NOT NULL DEFAULT 3,
      compress_model_context_window INTEGER,
      compress_preserve_recent_tokens INTEGER,
      compress_system_prompt TEXT,
      assistant_kind TEXT NOT NULL DEFAULT 'companion',
      emoji_group_id TEXT,
      emoji_enabled INTEGER NOT NULL DEFAULT 0,
      emoji_group_ids TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (vault_id, id)
    )
  `)

  const freshCols = await columnNames(exec, 'agent_assistants')
  const selectEmojiGroupId = freshCols.has('emoji_group_id')
    ? 'emoji_group_id'
    : 'NULL AS emoji_group_id'
  const selectEmojiEnabled = freshCols.has('emoji_enabled')
    ? 'emoji_enabled'
    : '0 AS emoji_enabled'
  const selectEmojiGroupIds = freshCols.has('emoji_group_ids')
    ? 'emoji_group_ids'
    : 'NULL AS emoji_group_ids'
  const selectCompressThreshold = freshCols.has('compress_token_threshold')
    ? 'compress_token_threshold'
    : '150000 AS compress_token_threshold'
  const selectCompressKeep = freshCols.has('compress_keep_turns')
    ? 'compress_keep_turns'
    : '3 AS compress_keep_turns'
  const selectCompressCtx = freshCols.has('compress_model_context_window')
    ? 'compress_model_context_window'
    : 'NULL AS compress_model_context_window'
  const selectCompressPreserve = freshCols.has('compress_preserve_recent_tokens')
    ? 'compress_preserve_recent_tokens'
    : 'NULL AS compress_preserve_recent_tokens'
  const selectCompressPrompt = freshCols.has('compress_system_prompt')
    ? 'compress_system_prompt'
    : 'NULL AS compress_system_prompt'
  const selectKind = freshCols.has('assistant_kind')
    ? 'assistant_kind'
    : `'companion' AS assistant_kind`

  await exec(`
    INSERT INTO agent_assistants__v14 (
      id, vault_id, name, emoji, description, avatar_path, system_prompt,
      is_default, is_pinned, context_window, provider_id, model_id,
      compress_token_threshold, compress_keep_turns, compress_model_context_window,
      compress_preserve_recent_tokens, compress_system_prompt, assistant_kind,
      emoji_group_id, emoji_enabled, emoji_group_ids, sort_order, created_at, updated_at
    )
    SELECT
      id, vault_id, name, emoji, description, avatar_path, system_prompt,
      is_default, is_pinned, context_window, provider_id, model_id,
      ${selectCompressThreshold}, ${selectCompressKeep}, ${selectCompressCtx},
      ${selectCompressPreserve}, ${selectCompressPrompt}, ${selectKind},
      ${selectEmojiGroupId}, ${selectEmojiEnabled}, ${selectEmojiGroupIds},
      sort_order, created_at, updated_at
    FROM agent_assistants
    WHERE vault_id IS NOT NULL AND TRIM(vault_id) != ''
  `)

  await exec(`DROP TABLE agent_assistants`)
  await exec(`ALTER TABLE agent_assistants__v14 RENAME TO agent_assistants`)

  return { rebuiltPk: true, deletedOrphans }
}

export async function migrateSummariesAndAssistantsVaultV14(exec: SqlExec): Promise<{
  summaries: Awaited<ReturnType<typeof ensureSummariesVaultIsolation>>
  assistants: Awaited<ReturnType<typeof ensureAssistantsVaultIsolation>>
}> {
  const summaries = await ensureSummariesVaultIsolation(exec)
  const assistants = await ensureAssistantsVaultIsolation(exec)
  return { summaries, assistants }
}
