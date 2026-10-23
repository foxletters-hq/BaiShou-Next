import type { ISqlExecutor } from '@baishou/shared'

/**
 * 删除仓库时清理 agent.db 中按 vault_id 可定位的派生数据。
 * 必须在删目录之前调用（失败时目录仍在，可重试清理）。
 *
 * V1.3 / V2.2：sessions（级联 messages/parts）、memory_embeddings、graph_*、embed_ledger。
 * V1.4：summaries、agent_assistants。
 * compression_snapshots：无 vault_id，按 session 子查询清理。
 */
export async function purgeVaultDerivedData(
  db: ISqlExecutor,
  vaultId: string
): Promise<{
  sessions: number
  embeddings: number
  graphNodes: number
  graphEdges: number
  diaryEmbedJobs: number
  embedLedger: number
  summaries: number
  assistants: number
  compressionSnapshots: number
}> {
  const id = vaultId.trim()
  if (!id) {
    throw new Error('purgeVaultDerivedData: vaultId is required')
  }

  const tableExists = async (name: string): Promise<boolean> => {
    const res = await db.execute({
      sql: `SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
      args: [name]
    })
    return res.rows.length > 0
  }

  const count = async (sql: string, args: Array<string | number> = []) => {
    const res = await db.execute({ sql, args })
    return Number((res.rows[0] as { c?: unknown } | undefined)?.c ?? 0)
  }

  const sessions = await count(`SELECT count(*) as c FROM agent_sessions WHERE vault_id = ?`, [id])
  const compressionSnapshots = await count(
    `SELECT count(*) as c FROM compression_snapshots
     WHERE session_id IN (SELECT id FROM agent_sessions WHERE vault_id = ?)`,
    [id]
  )
  const embeddings = await count(`SELECT count(*) as c FROM memory_embeddings WHERE vault_id = ?`, [
    id
  ])
  const graphNodes = await count(`SELECT count(*) as c FROM graph_nodes WHERE vault_id = ?`, [id])
  const graphEdges = await count(`SELECT count(*) as c FROM graph_edges WHERE vault_id = ?`, [id])
  const hasDiaryEmbedJobs = await tableExists('diary_embed_jobs')
  const hasEmbedLedger = await tableExists('embed_ledger')
  const diaryEmbedJobs = hasDiaryEmbedJobs
    ? await count(`SELECT count(*) as c FROM diary_embed_jobs WHERE vault_id = ?`, [id])
    : 0
  const embedLedger = hasEmbedLedger
    ? await count(`SELECT count(*) as c FROM embed_ledger WHERE vault_id = ?`, [id])
    : 0
  const summaries = await count(`SELECT count(*) as c FROM summaries WHERE vault_id = ?`, [id])
  const assistants = await count(`SELECT count(*) as c FROM agent_assistants WHERE vault_id = ?`, [
    id
  ])

  // 先清压缩快照（依赖 session 子查询），再删 sessions → CASCADE messages / parts
  await db.execute({
    sql: `DELETE FROM compression_snapshots
          WHERE session_id IN (SELECT id FROM agent_sessions WHERE vault_id = ?)`,
    args: [id]
  })
  await db.execute({
    sql: `DELETE FROM agent_sessions WHERE vault_id = ?`,
    args: [id]
  })
  await db.execute({
    sql: `DELETE FROM memory_embeddings WHERE vault_id = ?`,
    args: [id]
  })
  await db.execute({
    sql: `DELETE FROM graph_edges WHERE vault_id = ?`,
    args: [id]
  })
  await db.execute({
    sql: `DELETE FROM graph_node_aliases WHERE vault_id = ?`,
    args: [id]
  })
  await db.execute({
    sql: `DELETE FROM graph_nodes WHERE vault_id = ?`,
    args: [id]
  })
  if (hasDiaryEmbedJobs) {
    await db.execute({
      sql: `DELETE FROM diary_embed_jobs WHERE vault_id = ?`,
      args: [id]
    })
  }
  if (hasEmbedLedger) {
    await db.execute({
      sql: `DELETE FROM embed_ledger WHERE vault_id = ?`,
      args: [id]
    })
  }
  await db.execute({
    sql: `DELETE FROM summaries WHERE vault_id = ?`,
    args: [id]
  })
  await db.execute({
    sql: `DELETE FROM agent_assistants WHERE vault_id = ?`,
    args: [id]
  })

  return {
    sessions,
    embeddings,
    graphNodes,
    graphEdges,
    diaryEmbedJobs,
    embedLedger,
    summaries,
    assistants,
    compressionSnapshots
  }
}
