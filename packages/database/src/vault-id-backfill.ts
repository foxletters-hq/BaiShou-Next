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

/** 日记 source_id 前缀 name → vault_id，并将带 vault_id 的裸数字 source_id 规范化为 vault_id#id */
export async function rewriteDiaryEmbeddingSourceIdPrefixes(
  exec: SqlExecFn,
  map: VaultNameToIdMap
): Promise<number> {
  if (!(await tableExists(exec, 'memory_embeddings'))) return 0
  const cols = await columnNames(exec, 'memory_embeddings')

  let rewritten = 0

  // 1. 行本身已有稳定 vault_id，但 source_id 前缀仍是旧仓库名（非 vlt_）时，直接对齐到行的 vault_id
  if (cols.has('vault_id')) {
    const aligned = await exec(`
      UPDATE memory_embeddings
      SET source_id = vault_id || substr(source_id, instr(source_id, '#'))
      WHERE source_type = 'diary'
        AND vault_id LIKE 'vlt_%'
        AND instr(source_id, '#') > 1
        AND substr(source_id, 1, instr(source_id, '#') - 1) NOT LIKE 'vlt_%'
    `)
    rewritten += Number(aligned.rowsAffected ?? 0)
  }

  // 2. 其余 Name#id 前缀按映射表改写
  const res = await exec(`
    SELECT DISTINCT substr(source_id, 1, instr(source_id, '#') - 1) AS prefix
    FROM memory_embeddings
    WHERE source_type = 'diary' AND instr(source_id, '#') > 1
  `)

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

  // 3. 裸数字 diaryId（无 #）且已有 vault_id：统一补齐为 vault_id#diaryId
  if (cols.has('vault_id')) {
    const bare = await exec(`
      UPDATE memory_embeddings
      SET source_id = vault_id || '#' || source_id
      WHERE source_type = 'diary'
        AND instr(source_id, '#') = 0
        AND source_id != ''
        AND vault_id IS NOT NULL AND vault_id != ''
    `)
    rewritten += Number(bare.rowsAffected ?? 0)
  }

  return rewritten
}

/**
 * 清理因历史裸 source_id / 旧 group_id / 跨端影子索引 ID 漂移导致的重复向量行，
 * 并同步修正 embed_ledger。
 */
async function deduplicateMemoryEmbeddings(exec: SqlExecFn): Promise<void> {
  if (!(await tableExists(exec, 'memory_embeddings'))) return
  const cols = await columnNames(exec, 'memory_embeddings')
  if (!cols.has('vault_id') || !cols.has('chunk_index')) return

  // 1. 同一 (vault_id, source_type, source_id, chunk_index) 仅保留最新写入的一条（MAX(rowid)）
  await exec(`
    DELETE FROM memory_embeddings
    WHERE vault_id IS NOT NULL AND vault_id != ''
      AND rowid NOT IN (
        SELECT MAX(rowid)
        FROM memory_embeddings
        WHERE vault_id IS NOT NULL AND vault_id != ''
        GROUP BY vault_id, source_type, source_id, chunk_index
      )
  `)

  // 2. 日记向量：若同一仓库同一日期（metadata_json.$.date 或 [YYYY-MM-DD 日记:] 前缀）存在多个不同 source_id，
  //    仅保留最新写入的那个 source_id，清理旧 diaryId 留下的重复切片。
  if (cols.has('metadata_json') && cols.has('chunk_text')) {
    await exec(`
      WITH diary_dated AS (
        SELECT
          rowid AS rid,
          vault_id,
          source_id,
          COALESCE(
            NULLIF(json_extract(metadata_json, '$.date'), ''),
            CASE
              WHEN substr(chunk_text, 1, 1) = '[' AND substr(chunk_text, 12, 5) = ' 日记:]'
              THEN substr(chunk_text, 2, 10)
              ELSE ''
            END
          ) AS diary_date
        FROM memory_embeddings
        WHERE source_type = 'diary'
          AND vault_id IS NOT NULL AND vault_id != ''
      ),
      latest_per_date AS (
        SELECT vault_id, diary_date, MAX(rid) AS max_rid
        FROM diary_dated
        WHERE diary_date != ''
        GROUP BY vault_id, diary_date
      ),
      canonical_source AS (
        SELECT d.vault_id, d.diary_date, d.source_id
        FROM diary_dated d
        INNER JOIN latest_per_date l
          ON d.rid = l.max_rid
      )
      DELETE FROM memory_embeddings
      WHERE rowid IN (
        SELECT d.rid
        FROM diary_dated d
        INNER JOIN canonical_source c
          ON d.vault_id = c.vault_id
         AND d.diary_date = c.diary_date
        WHERE d.source_id != c.source_id
      )
    `)

    // 3. 兜底：同一仓库下完全相同的 (chunk_index, chunk_text) 日记切片只保留最新一条
    await exec(`
      DELETE FROM memory_embeddings
      WHERE source_type = 'diary'
        AND vault_id IS NOT NULL AND vault_id != ''
        AND rowid NOT IN (
          SELECT MAX(rowid)
          FROM memory_embeddings
          WHERE source_type = 'diary'
            AND vault_id IS NOT NULL AND vault_id != ''
          GROUP BY vault_id, chunk_index, chunk_text
        )
    `)
  }

  // 4. 同步对齐 embed_ledger（清理裸 source_id、被去重掉的孤立 source_id 及修正 chunk_count）
  if (await tableExists(exec, 'embed_ledger')) {
    const ledgerCols = await columnNames(exec, 'embed_ledger')
    if (
      ledgerCols.has('vault_id') &&
      ledgerCols.has('source_id') &&
      ledgerCols.has('chunk_count')
    ) {
      await exec(`
        DELETE FROM embed_ledger
        WHERE source_type = 'diary'
          AND instr(source_id, '#') = 0
          AND source_id != ''
          AND vault_id IS NOT NULL AND vault_id != ''
          AND EXISTS (
            SELECT 1 FROM embed_ledger e2
            WHERE e2.vault_id = embed_ledger.vault_id
              AND e2.source_type = 'diary'
              AND e2.source_id = embed_ledger.vault_id || '#' || embed_ledger.source_id
          )
      `)
      await exec(`
        UPDATE embed_ledger
        SET source_id = vault_id || '#' || source_id
        WHERE source_type = 'diary'
          AND instr(source_id, '#') = 0
          AND source_id != ''
          AND vault_id IS NOT NULL AND vault_id != ''
      `)
      await exec(`
        DELETE FROM embed_ledger
        WHERE chunk_count > 0
          AND source_type IN ('diary', 'memory')
          AND NOT EXISTS (
            SELECT 1 FROM memory_embeddings m
            WHERE m.vault_id = embed_ledger.vault_id
              AND m.source_type = embed_ledger.source_type
              AND m.source_id = embed_ledger.source_id
          )
      `)
      await exec(`
        UPDATE embed_ledger
        SET chunk_count = (
          SELECT COUNT(*)
          FROM memory_embeddings m
          WHERE m.vault_id = embed_ledger.vault_id
            AND m.source_type = embed_ledger.source_type
            AND m.source_id = embed_ledger.source_id
        )
        WHERE chunk_count > 0
          AND source_type IN ('diary', 'memory')
      `)
    }
  }
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
  if (await tableExists(exec, 'memory_embeddings')) {
    await exec(`
      UPDATE memory_embeddings
      SET group_id = 'diary'
      WHERE source_type = 'diary'
        AND (
          group_id LIKE 'diary:%'
          OR group_id IN ('diary_batch', 'diary_auto', 'diary_post_sync')
        )
        AND vault_id IS NOT NULL AND vault_id != ''
    `)
    await exec(`
      UPDATE memory_embeddings
      SET group_id = 'memory'
      WHERE source_type = 'memory'
        AND group_id LIKE 'memory:%'
        AND vault_id IS NOT NULL AND vault_id != ''
    `)
    await deduplicateMemoryEmbeddings(exec)
  }
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
