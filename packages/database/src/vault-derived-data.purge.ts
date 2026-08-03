import type { ISqlExecutor } from '@baishou/shared'

/**
 * 删除仓库时清理 agent.db 中按 vault_id 可定位的派生数据。
 * 必须在删目录之前调用（失败时目录仍在，可重试清理）。
 *
 * V1.3 / V2.2 范围：sessions（级联 messages/parts）、memory_embeddings、graph_*、diary_embed_jobs。
 * summaries / agent_assistants 尚无 vault 列（V1.4）；当前表只缓存活跃仓库，删非活跃库时通常无对应行。
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
}> {
  const id = vaultId.trim()
  if (!id) {
    throw new Error('purgeVaultDerivedData: vaultId is required')
  }

  const count = async (sql: string, args: Array<string | number> = []) => {
    const res = await db.execute({ sql, args })
    return Number((res.rows[0] as { c?: unknown } | undefined)?.c ?? 0)
  }

  const sessions = await count(`SELECT count(*) as c FROM agent_sessions WHERE vault_id = ?`, [id])
  const embeddings = await count(
    `SELECT count(*) as c FROM memory_embeddings WHERE vault_id = ?`,
    [id]
  )
  const graphNodes = await count(`SELECT count(*) as c FROM graph_nodes WHERE vault_id = ?`, [id])
  const graphEdges = await count(`SELECT count(*) as c FROM graph_edges WHERE vault_id = ?`, [id])
  const diaryEmbedJobs = await count(
    `SELECT count(*) as c FROM diary_embed_jobs WHERE vault_id = ?`,
    [id]
  )

  // sessions → CASCADE messages / parts（及 FTS 触发器）
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
    sql: `DELETE FROM graph_nodes WHERE vault_id = ?`,
    args: [id]
  })
  await db.execute({
    sql: `DELETE FROM diary_embed_jobs WHERE vault_id = ?`,
    args: [id]
  })

  return { sessions, embeddings, graphNodes, graphEdges, diaryEmbedJobs }
}
