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
 * 回填 memory_embeddings.vault_name。可安全连跑；返回各路径「本轮可能更新」的判定计数口径。
 */
export async function backfillMemoryEmbeddingsVaultName(
  exec: SqlExecFn
): Promise<MemoryEmbeddingsVaultBackfillCounts> {
  const emptyVault = `(vault_name IS NULL OR vault_name = '')`

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
    SET vault_name = substr(group_id, 8)
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
    SET vault_name = substr(group_id, 7)
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
    SET vault_name = substr(source_id, 1, instr(source_id, '#') - 1)
    WHERE ${emptyVault}
      AND source_type = 'diary'
      AND instr(source_id, '#') > 1
  `)

  // 4) 聊天：group_id = session id → join agent_sessions.vault_name
  const chatCandidates = await countRows(
    exec,
    `SELECT count(*) as c FROM memory_embeddings me
     WHERE (me.vault_name IS NULL OR me.vault_name = '')
       AND me.source_type = 'chat'
       AND EXISTS (
         SELECT 1 FROM agent_sessions s
         WHERE s.id = me.group_id AND s.vault_name IS NOT NULL AND s.vault_name != ''
       )`
  )
  await exec(`
    UPDATE memory_embeddings
    SET vault_name = (
      SELECT s.vault_name FROM agent_sessions s WHERE s.id = memory_embeddings.group_id
    )
    WHERE ${emptyVault}
      AND source_type = 'chat'
      AND EXISTS (
        SELECT 1 FROM agent_sessions s
        WHERE s.id = memory_embeddings.group_id
          AND s.vault_name IS NOT NULL
          AND s.vault_name != ''
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
export async function countEmptyVaultEmbeddingsByBucket(exec: SqlExecFn): Promise<{
  memoryPrefixEmpty: number
  diaryPrefixEmpty: number
  diarySourceIdEmpty: number
  chatJoinableEmpty: number
  legacyManualEmpty: number
  totalEmpty: number
}> {
  const emptyVault = `(vault_name IS NULL OR vault_name = '')`
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
       WHERE (me.vault_name IS NULL OR me.vault_name = '')
         AND me.source_type = 'chat'
         AND EXISTS (
           SELECT 1 FROM agent_sessions s
           WHERE s.id = me.group_id AND s.vault_name IS NOT NULL AND s.vault_name != ''
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
