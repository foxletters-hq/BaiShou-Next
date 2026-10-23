import React, { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import type { MemoryReadinessRowId } from '@baishou/shared'
import { getRagRuntimeSnapshot, subscribeRagRuntime } from '../settings/rag-runtime-cache'
import { MemoryOrganizePanelHost } from './MemoryOrganizePanelHost'
import { MemoryReadinessBar } from './MemoryReadinessBar'
import { useMemoryReadiness } from './useMemoryReadiness'
import styles from './MemoryCenterPage.module.css'

export function MemoryCenterOrganizeSlot(props: {
  onConfigureEmbedding: () => void
  onStartOrganize: () => void
}) {
  const readiness = useMemoryReadiness()
  const ragState = useSyncExternalStore(
    subscribeRagRuntime,
    () => getRagRuntimeSnapshot().activeRagState
  )
  const [organizeOpen, setOrganizeOpen] = useState(false)
  const prevErrorRef = useRef(ragState.error)

  useEffect(() => {
    if (ragState.error && ragState.error !== prevErrorRef.current) {
      setOrganizeOpen(true)
    }
    prevErrorRef.current = ragState.error
  }, [ragState.error])

  const topBarOmit = useMemo(() => {
    const omit: MemoryReadinessRowId[] = ['extract', 'graph']
    for (const row of readiness.rows) {
      if (row.id === 'embedding' && row.state === 'ready') omit.push('embedding')
    }
    return omit
  }, [readiness.rows])

  return (
    <>
      <div className={styles.readinessSlot}>
        <MemoryReadinessBar
          wrap
          showLabel={false}
          omit={topBarOmit}
          rows={readiness.rows}
          onConfigureEmbedding={props.onConfigureEmbedding}
          onStartIndex={() => {
            setOrganizeOpen(true)
            props.onStartOrganize()
          }}
          onStartOrganize={() => {
            setOrganizeOpen(true)
            props.onStartOrganize()
          }}
          onOpenOrganize={() => setOrganizeOpen(true)}
          pendingEmbedParts={readiness.pendingEmbedParts}
          pendingGraphCount={readiness.pendingGraphCount}
          indexing={readiness.indexing}
          extracting={readiness.graphExtracting}
          organizePipeline={readiness.organizePipeline}
          hasError={Boolean(ragState.error)}
        />
      </div>
      <MemoryOrganizePanelHost
        open={organizeOpen}
        onClose={() => setOrganizeOpen(false)}
        onContinue={() => {
          props.onStartOrganize()
        }}
      />
    </>
  )
}
