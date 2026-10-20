import { logger } from '@baishou/shared'
import { NotebookGraphIndexService, NotebookGraphRawManager } from '@baishou/core-mobile'
import { NotebookGraphRepository, expoKnowledgeConnectionManager } from '@baishou/database/expo'
import { ensureMobileKnowledgeConnected } from './mobile-knowledge-repo'
import { createMobileFileSystem } from './create-mobile-file-system'
import { agentDbRuntimeRef } from './mobile-agent-db-runtime-ref'
import { resolveMobileEmbeddingForHydration } from './mobile-raw-data-source.runtime'
import { notifyNotebookGraphChanged } from './mobile-notebook-graph-events'

/** 图谱复核服务共用的运行时依赖与后台索引同步调度。 */

export function requireVaultId(vaultId: string): string {
  const id = vaultId.trim()
  if (!id) throw new Error('active vault not ready')
  return id
}

export function requireNotebookId(notebookId: string): string {
  const id = notebookId.trim()
  if (!id) throw new Error('notebookId required')
  return id
}

export function parseAliases(raw: string | string[] | undefined): string[] {
  if (Array.isArray(raw)) return raw.filter((item): item is string => typeof item === 'string')
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw) as unknown
      if (Array.isArray(parsed)) {
        return parsed.filter((item): item is string => typeof item === 'string')
      }
    } catch {
      /* ignore */
    }
  }
  return []
}

export async function requireRepo(): Promise<NotebookGraphRepository> {
  await ensureMobileKnowledgeConnected()
  return new NotebookGraphRepository(expoKnowledgeConnectionManager.getDb())
}

export function createRaw(): NotebookGraphRawManager {
  const runtime = agentDbRuntimeRef.current
  if (!runtime?.pathService) throw new Error('runtime not ready')
  return new NotebookGraphRawManager(runtime.pathService, createMobileFileSystem())
}

export async function resolveVaultName(vaultId: string): Promise<string> {
  const runtime = agentDbRuntimeRef.current
  const name = await runtime?.pathService?.getActiveVaultNameForContext?.().catch(() => vaultId)
  return name?.trim() || vaultId
}

export async function syncNotebookGraphIndex(notebookId: string, vaultId: string): Promise<void> {
  const runtime = agentDbRuntimeRef.current
  const raw = createRaw()
  const repo = await requireRepo()
  let embedQuery: ((text: string) => Promise<number[] | null>) | undefined
  let modelId: string | undefined
  if (runtime?.settingsManager) {
    try {
      const { EmbeddingAdapter } = await import('@baishou/ai')
      const emb = await resolveMobileEmbeddingForHydration(runtime.settingsManager)
      if (emb.embeddingProvider && emb.embeddingModelId) {
        const adapter = new EmbeddingAdapter(emb.embeddingProvider, emb.embeddingModelId)
        if (adapter.isConfigured) {
          embedQuery = (text) => adapter.embedQuery(text)
          modelId = adapter.embeddingModelId
        }
      }
    } catch {
      /* 没配嵌入时仍写入复核 */
    }
  }
  const index = new NotebookGraphIndexService(
    raw,
    repo,
    embedQuery && modelId ? { embedQuery, modelId } : null
  )
  await index.syncPendingIndex({ vaultId, notebookId, absentSweep: 'off' })
}

/**
 * 复核后的后台索引同步。同一本笔记本同一时间只跑一轮；运行期间再来的请求
 * 合并成一轮补跑，避免连点通过时多轮全量分片同步并发抢 SQLite 与 JS 线程。
 */
const notebookIndexSyncs = new Map<string, { queued: boolean; done: Promise<void> }>()

export function scheduleNotebookGraphIndexSync(notebookId: string, vaultId: string): void {
  const key = `${vaultId}\u0000${notebookId}`
  const running = notebookIndexSyncs.get(key)
  if (running) {
    running.queued = true
    return
  }
  const state: { queued: boolean; done: Promise<void> } = {
    queued: false,
    done: Promise.resolve()
  }
  notebookIndexSyncs.set(key, state)
  state.done = (async () => {
    try {
      do {
        state.queued = false
        await syncNotebookGraphIndex(notebookId, vaultId)
      } while (state.queued)
    } catch (e) {
      logger.warn('[NotebookGraphReview] background index sync failed', e as Error)
    } finally {
      notebookIndexSyncs.delete(key)
      notifyNotebookGraphChanged(notebookId)
    }
  })()
}

/** 读取图谱索引前调用：若该笔记本有后台同步在跑，等它结束，避免读到同步前的数据。 */
export async function mobileWaitNotebookGraphIndexSync(
  notebookId: string,
  vaultId: string
): Promise<void> {
  const id = notebookId.trim()
  const vid = vaultId.trim()
  if (!id || !vid) return
  await notebookIndexSyncs.get(`${vid}\u0000${id}`)?.done
}
