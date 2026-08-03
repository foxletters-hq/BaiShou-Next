/**
 * 仓库身份 V2.2：六表 vault_name → vault_id 回填 + diary source_id 前缀重写。
 *
 * 策略：
 * 1. 若仍有 vault_name 列 → RENAME COLUMN 为 vault_id（或 ADD vault_id 后复制再丢弃旧列语义）
 * 2. 将仍为「名字」的 vault_id 值按 name→id 映射改写
 * 3. 日记 embedding source_id：`Name#id` → `vlt_…#id`（无 # 的 legacy 不动）
 * 4. group_id 存量不改（列已有 vault_id）
 */

import { isVaultId } from '@baishou/shared'
import {
  ensureVaultIdsForNames,
  resolveVaultIdFromName,
  type VaultNameToIdMap
} from './vault-id-map'
import type { SqlExecFn } from './memory-embeddings-vault-backfill'

export type { SqlExecFn }

export interface VaultIdBackfillCounts {
  tablesRenamed: string[]
  valuesRemapped: number
  diarySourceIdsRewritten: number
  distinctNamesMapped: number
}

const AGENT_VAULT_TABLES = [
  { table: 'agent_sessions', nullable: false },
  { table: 'memory_embeddings', nullable: true },
  { table: 'graph_nodes', nullable: false },
  { table: 'graph_edges', nullable: false },
  { table: 'diary_embed_jobs', nullable: false }
] as const

async function tableExists(exec: SqlExecFn, table: string): Promise<boolean> {
  const res = await exec(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`, [table])
  return res.rows.length > 0
}

async function columnNames(exec: SqlExecFn, table: string): Promise<Set<string>> {
  const info = await exec(`PRAGMA table_info(${table})`)
  return new Set(info.rows.map((c) => String((c as { name?: unknown }).name ?? '')).filter(Boolean))
}

async function renameColumnIfNeeded(
  exec: SqlExecFn,
  table: string,
  from: string,
  to: string
): Promise<boolean> {
  const cols = await columnNames(exec, table)
  if (cols.has(to) && !cols.has(from)) return false
  if (!cols.has(from)) return false
  if (cols.has(to)) {
    // 双列并存：把 vault_name 非空值拷到 vault_id 空位，再忽略旧列（SQLite DROP COLUMN 视版本）
    await exec(`
      UPDATE ${table}
      SET ${to} = ${from}
      WHERE (${to} IS NULL OR ${to} = '')
        AND ${from} IS NOT NULL AND ${from} != ''
    `)
    try {
      await exec(`ALTER TABLE ${table} DROP COLUMN ${from}`)
    } catch {
      // 旧 SQLite 无 DROP COLUMN：保留死列，读写只认 vault_id
    }
    return true
  }
  await exec(`ALTER TABLE ${table} RENAME COLUMN ${from} TO ${to}`)
  return true
}

async function collectDistinctVaultValues(exec: SqlExecFn): Promise<string[]> {
  const names = new Set<string>()
  for (const { table } of AGENT_VAULT_TABLES) {
    if (!(await tableExists(exec, table))) continue
    const cols = await columnNames(exec, table)
    const col = cols.has('vault_id') ? 'vault_id' : cols.has('vault_name') ? 'vault_name' : null
    if (!col) continue
    const res = await exec(
      `SELECT DISTINCT ${col} AS v FROM ${table} WHERE ${col} IS NOT NULL AND ${col} != ''`
    )
    for (const row of res.rows) {
      const v = String((row as { v?: unknown }).v ?? '')
      if (v) names.add(v)
    }
  }

  // diary source_id 前缀（可能尚未进 vault 列）
  if (await tableExists(exec, 'memory_embeddings')) {
    const res = await exec(`
      SELECT DISTINCT substr(source_id, 1, instr(source_id, '#') - 1) AS v
      FROM memory_embeddings
      WHERE source_type = 'diary' AND instr(source_id, '#') > 1
    `)
    for (const row of res.rows) {
      const v = String((row as { v?: unknown }).v ?? '')
      if (v && !isVaultId(v)) names.add(v)
    }
  }

  return [...names]
}

async function remapTableVaultValues(
  exec: SqlExecFn,
  table: string,
  map: VaultNameToIdMap
): Promise<number> {
  if (!(await tableExists(exec, table))) return 0
  const cols = await columnNames(exec, table)
  if (!cols.has('vault_id')) return 0

  const res = await exec(
    `SELECT DISTINCT vault_id AS v FROM ${table} WHERE vault_id IS NOT NULL AND vault_id != ''`
  )
  let updated = 0
  for (const row of res.rows) {
    const old = String((row as { v?: unknown }).v ?? '')
    if (!old || isVaultId(old)) continue
    const next = resolveVaultIdFromName(old, map)
    if (next === old) continue
    const r = await exec(`UPDATE ${table} SET vault_id = ? WHERE vault_id = ?`, [next, old])
    updated += Number(r.rowsAffected ?? 0)
  }
  return updated
}

/** 日记 source_id 前缀 name → vault_id；无 # 的 legacy 不动 */
export async function rewriteDiaryEmbeddingSourceIdPrefixes(
  exec: SqlExecFn,
  map: VaultNameToIdMap
): Promise<number> {
  if (!(await tableExists(exec, 'memory_embeddings'))) return 0

  const res = await exec(`
    SELECT DISTINCT substr(source_id, 1, instr(source_id, '#') - 1) AS prefix
    FROM memory_embeddings
    WHERE source_type = 'diary' AND instr(source_id, '#') > 1
  `)

  let rewritten = 0
  for (const row of res.rows) {
    const prefix = String((row as { prefix?: unknown }).prefix ?? '')
    if (!prefix || isVaultId(prefix)) continue
    const vaultId = resolveVaultIdFromName(prefix, map)
    if (vaultId === prefix) continue
    // 用精确前缀替换：prefix + '#' → vaultId + '#'
    const r = await exec(
      `
      UPDATE memory_embeddings
      SET source_id = ? || substr(source_id, length(?) + 1)
      WHERE source_type = 'diary'
        AND source_id LIKE ? || '#%'
    `,
      [vaultId, prefix, prefix]
    )
    rewritten += Number(r.rowsAffected ?? 0)
  }
  return rewritten
}

async function refreshVaultIndexes(exec: SqlExecFn): Promise<void> {
  // 旧索引名 → 新索引名（IF EXISTS / IF NOT EXISTS）
  const drops = [
    'memory_embeddings_vault_source',
    'diary_embed_jobs_vault_diary_unique',
    'graph_nodes_vault_type',
    'graph_edges_vault_type_current',
    'graph_edges_source_ref',
    'graph_edges_shard_month'
  ]
  for (const name of drops) {
    try {
      await exec(`DROP INDEX IF EXISTS ${name}`)
    } catch {
      /* ignore */
    }
  }

  const tryIndex = async (ddl: string) => {
    try {
      await exec(ddl)
    } catch {
      /* 表缺列 / 不存在时跳过 */
    }
  }

  if (await tableExists(exec, 'memory_embeddings')) {
    await tryIndex(`
      CREATE INDEX IF NOT EXISTS memory_embeddings_vault_id_source
      ON memory_embeddings (vault_id, source_type)
    `)
  }
  if (await tableExists(exec, 'diary_embed_jobs')) {
    await tryIndex(`
      CREATE UNIQUE INDEX IF NOT EXISTS diary_embed_jobs_vault_id_diary_unique
      ON diary_embed_jobs (vault_id, diary_id)
    `)
  }
  if (await tableExists(exec, 'graph_nodes')) {
    await tryIndex(`
      CREATE INDEX IF NOT EXISTS graph_nodes_vault_id_type
      ON graph_nodes (vault_id, node_type)
    `)
  }
  if (await tableExists(exec, 'graph_edges')) {
    await tryIndex(`
      CREATE INDEX IF NOT EXISTS graph_edges_vault_id_type_current
      ON graph_edges (vault_id, edge_type, is_current)
    `)
    await tryIndex(`
      CREATE INDEX IF NOT EXISTS graph_edges_vault_id_source_ref
      ON graph_edges (vault_id, source_ref)
    `)
    await tryIndex(`
      CREATE INDEX IF NOT EXISTS graph_edges_vault_id_shard_month
      ON graph_edges (vault_id, shard_month)
    `)
  }
}

/**
 * 主入口：rename + name→id 回填 + diary source_id 重写。幂等。
 */
export async function migrateAgentDbVaultNameToVaultId(
  exec: SqlExecFn,
  seedMap?: VaultNameToIdMap | null
): Promise<VaultIdBackfillCounts> {
  const tablesRenamed: string[] = []

  for (const { table } of AGENT_VAULT_TABLES) {
    if (!(await tableExists(exec, table))) continue
    const renamed = await renameColumnIfNeeded(exec, table, 'vault_name', 'vault_id')
    if (renamed) tablesRenamed.push(table)
  }

  // 缺 vault_id 的 memory_embeddings（极旧库）由 AGENT_DB_COLUMN_PATCHES 补列

  const distinct = await collectDistinctVaultValues(exec)
  const map = ensureVaultIdsForNames(distinct, seedMap)

  let valuesRemapped = 0
  for (const { table } of AGENT_VAULT_TABLES) {
    valuesRemapped += await remapTableVaultValues(exec, table, map)
  }

  const diarySourceIdsRewritten = await rewriteDiaryEmbeddingSourceIdPrefixes(exec, map)
  await refreshVaultIndexes(exec)

  return {
    tablesRenamed,
    valuesRemapped,
    diarySourceIdsRewritten,
    distinctNamesMapped: map.size
  }
}

/** 保留 V1.0 名字回填（在 rename 之前调用，便于旧库先从 group_id 推断 vault_name） */
export {
  backfillMemoryEmbeddingsVaultName,
  countEmptyVaultEmbeddingsByBucket
} from './memory-embeddings-vault-backfill'
export type { MemoryEmbeddingsVaultBackfillCounts } from './memory-embeddings-vault-backfill'
