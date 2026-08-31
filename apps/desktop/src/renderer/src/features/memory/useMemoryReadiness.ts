import { useCallback, useEffect, useState } from 'react'
import {
  buildMemoryReadinessRows,
  isEmbeddingConfiguredForMemory,
  type GlobalModelsConfig,
  type MemoryReadinessRow,
  type RagConfig
} from '@baishou/shared'

type ReadinessSnapshot = {
  rows: MemoryReadinessRow[]
  embeddingConfigured: boolean
  unindexedDiaryCount: number
  pendingGraphCount: number
}

const EMPTY: ReadinessSnapshot = {
  rows: buildMemoryReadinessRows({
    globalModels: null,
    ragConfig: null,
    unindexedDiaryCount: 0,
    pendingGraphCount: 0
  }),
  embeddingConfigured: false,
  unindexedDiaryCount: 0,
  pendingGraphCount: 0
}

let inFlight: Promise<ReadinessSnapshot> | null = null

async function fetchMemoryReadinessSnapshot(): Promise<ReadinessSnapshot> {
  if (inFlight) return inFlight
  inFlight = (async () => {
    const ragApi = (
      window.api as {
        rag?: { getUnindexedDiaryCount?: () => Promise<number> }
      }
    ).rag
    const [pending, unindexedCount, globalModels, ragConfig] = await Promise.all([
      window.api.graph.listPendingReextract().catch(() => []),
      (ragApi?.getUnindexedDiaryCount?.() ?? Promise.resolve(0)).catch(() => 0),
      window.api.settings.getGlobalModels().catch(() => null),
      window.api.settings.getRagConfig().catch(() => null)
    ])
    const pendingGraphCount = Array.isArray(pending) ? pending.length : 0
    const unindexedDiaryCount = typeof unindexedCount === 'number' ? unindexedCount : 0
    const models = globalModels as GlobalModelsConfig | null
    const rows = buildMemoryReadinessRows({
      globalModels: models,
      ragConfig: ragConfig as RagConfig | null,
      unindexedDiaryCount,
      pendingGraphCount
    })
    return {
      rows,
      embeddingConfigured: isEmbeddingConfiguredForMemory(models),
      unindexedDiaryCount,
      pendingGraphCount
    }
  })().finally(() => {
    inFlight = null
  })
  return inFlight
}

export function useMemoryReadiness() {
  const [snapshot, setSnapshot] = useState<ReadinessSnapshot>(EMPTY)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const next = await fetchMemoryReadinessSnapshot()
      setSnapshot(next)
    } catch {
      setSnapshot(EMPTY)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [refresh])

  return { ...snapshot, loading, refresh }
}
