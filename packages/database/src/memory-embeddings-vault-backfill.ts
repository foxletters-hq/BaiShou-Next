/**
 * 仓库隔离 V1.0：为 memory_embeddings 存量行回填 vault_name。
 * 幂等：仅更新 vault_name 为空/null 的行；遗留手动记忆（manual / manual_memory）保持空值。
 */

export interface MemoryEmbeddingsVaultBackfillCounts {
  memoryFromGroupId: number
  diaryFromGroupId: number
  diaryFromSourceId: number
  chatFromSessionJoin: number
  /** group_id ∈ {manual, manual_memory} 且 vault_name 仍为空的行数（本轮不归属） */
  legacyManualUnscoped: number
}

export type SqlExecFn = (
  sql: string,
  args?: Array<string | number | null>
) => Promise<{ rows: Array<Record<string, unknown>>; rowsAffected?: number }>

async function countRows(exec: SqlExecFn, sql: string, args: Array<string | number | null> = []) {
  const result = await exec(sql, args)
  const row = result.rows[0] as { c?: unknown } | undefined
  return Number(row?.c ?? 0)
}

/**
 * 回填 memory_embeddings.vault_name 或 vault_id。
 * 兼容两种升级路径：
 * 1) 渐进升级：旧库带 vault_name 列，回填 vault_name，再由 V2.2 统一重命名并映射为 vault_id；
 * 2) 跨版本直接升级（从 main 升级）：旧库无 vault_name，由缺列补丁直接加了 vault_id 列，此时直接向 vault_id 回填名字，再由 V2.2 映射为 vlt_xxx。
 * 可安全连跑；返回各路径「本轮可能更新」的判定计数口径。
 */
export async function backfillMemoryEmbeddingsVaultName(
  exec: SqlExecFn,
  targetColumn: 'vault_name' | 'vault_id' = 'vault_name'
): Promise<MemoryEmbeddingsVaultBackfillCounts> {
  const col = targetColumn === 'vault_id' ? 'vault_id' : 'vault_name'
  const emptyVault = `(${col} IS NULL OR ${col} = '')`

  // 1) memory:X → X
  const memoryCandidates = await countRows(
    exec,
    `SELECT count(*) as c FROM memory_embeddings
     WHERE ${emptyVault}
       AND group_id LIKE 'memory:%'
       AND length(group_id) > 7`
  )
  await exec(`
    UPDATE memory_embeddings
    SET ${col} = substr(group_id, 8)
    WHERE ${emptyVault}
      AND group_id LIKE 'memory:%'
      AND length(group_id) > 7
  `)

  // 2) diary:X → X
  const diaryGroupCandidates = await countRows(
    exec,
    `SELECT count(*) as c FROM memory_embeddings
     WHERE ${emptyVault}
       AND group_id LIKE 'diary:%'
       AND length(group_id) > 6`
  )
  await exec(`
    UPDATE memory_embeddings
    SET ${col} = substr(group_id, 7)
    WHERE ${emptyVault}
      AND group_id LIKE 'diary:%'
      AND length(group_id) > 6
  `)

  // 3) 旧批次日记：source_id 形如 Vault#42
  const diarySourceCandidates = await countRows(
    exec,
    `SELECT count(*) as c FROM memory_embeddings
     WHERE ${emptyVault}
       AND source_type = 'diary'
       AND instr(source_id, '#') > 1`
  )
  await exec(`
    UPDATE memory_embeddings
    SET ${col} = substr(source_id, 1, instr(source_id, '#') - 1)
    WHERE ${emptyVault}
      AND source_type = 'diary'
      AND instr(source_id, '#') > 1
  `)

  // 4) 聊天：group_id = session id → join agent_sessions
  let sessionCol = 'vault_name'
  try {
    const sessionCols = await exec(`PRAGMA table_info(agent_sessions)`)
    const hasSessionVaultId = sessionCols.rows.some(
      (c) => (c as { name?: string }).name === 'vault_id'
    )
    const hasSessionVaultName = sessionCols.rows.some(
      (c) => (c as { name?: string }).name === 'vault_name'
    )
    if (hasSessionVaultId) {
      sessionCol = 'vault_id'
    } else if (hasSessionVaultName) {
      sessionCol = 'vault_name'
    }
  } catch {
    // default to vault_name
  }

  const chatCandidates = await countRows(
    exec,
    `SELECT count(*) as c FROM memory_embeddings me
     WHERE (${col} IS NULL OR ${col} = '')
       AND me.source_type = 'chat'
       AND EXISTS (
         SELECT 1 FROM agent_sessions s
         WHERE s.id = me.group_id AND s.${sessionCol} IS NOT NULL AND s.${sessionCol} != ''
       )`
  )
  await exec(`
    UPDATE memory_embeddings
    SET ${col} = (
      SELECT s.${sessionCol} FROM agent_sessions s WHERE s.id = memory_embeddings.group_id
    )
    WHERE ${emptyVault}
      AND source_type = 'chat'
      AND EXISTS (
        SELECT 1 FROM agent_sessions s
        WHERE s.id = memory_embeddings.group_id
          AND s.${sessionCol} IS NOT NULL
          AND s.${sessionCol} != ''
      )
  `)

  const legacyManualUnscoped = await countRows(
    exec,
    `SELECT count(*) as c FROM memory_embeddings
     WHERE ${emptyVault}
       AND group_id IN ('manual', 'manual_memory')`
  )

  return {
    memoryFromGroupId: memoryCandidates,
    diaryFromGroupId: diaryGroupCandidates,
    diaryFromSourceId: diarySourceCandidates,
    chatFromSessionJoin: chatCandidates,
    legacyManualUnscoped
  }
}

/** 供测试断言：统计各回填口径下仍为空的行（幂等二次跑后 candidate 计数应为 0，除遗留手动） */
export async function countEmptyVaultEmbeddingsByBucket(
  exec: SqlExecFn,
  targetColumn: 'vault_name' | 'vault_id' = 'vault_name'
): Promise<{
  memoryPrefixEmpty: number
  diaryPrefixEmpty: number
  diarySourceIdEmpty: number
  chatJoinableEmpty: number
  legacyManualEmpty: number
  totalEmpty: number
}> {
  const col = targetColumn === 'vault_id' ? 'vault_id' : 'vault_name'
  const emptyVault = `(${col} IS NULL OR ${col} = '')`

  let sessionCol = 'vault_name'
  try {
    const sessionCols = await exec(`PRAGMA table_info(agent_sessions)`)
    if (sessionCols.rows.some((c) => (c as { name?: string }).name === 'vault_id')) {
      sessionCol = 'vault_id'
    }
  } catch {
    // ignore
  }

  return {
    memoryPrefixEmpty: await countRows(
      exec,
      `SELECT count(*) as c FROM memory_embeddings
       WHERE ${emptyVault} AND group_id LIKE 'memory:%' AND length(group_id) > 7`
    ),
    diaryPrefixEmpty: await countRows(
      exec,
      `SELECT count(*) as c FROM memory_embeddings
       WHERE ${emptyVault} AND group_id LIKE 'diary:%' AND length(group_id) > 6`
    ),
    diarySourceIdEmpty: await countRows(
      exec,
      `SELECT count(*) as c FROM memory_embeddings
       WHERE ${emptyVault} AND source_type = 'diary' AND instr(source_id, '#') > 1`
    ),
    chatJoinableEmpty: await countRows(
      exec,
      `SELECT count(*) as c FROM memory_embeddings me
       WHERE (${col} IS NULL OR ${col} = '')
         AND me.source_type = 'chat'
         AND EXISTS (
           SELECT 1 FROM agent_sessions s
           WHERE s.id = me.group_id AND s.${sessionCol} IS NOT NULL AND s.${sessionCol} != ''
         )`
    ),
    legacyManualEmpty: await countRows(
      exec,
      `SELECT count(*) as c FROM memory_embeddings
       WHERE ${emptyVault} AND group_id IN ('manual', 'manual_memory')`
    ),
    totalEmpty: await countRows(
      exec,
      `SELECT count(*) as c FROM memory_embeddings WHERE ${emptyVault}`
    )
  }
}
