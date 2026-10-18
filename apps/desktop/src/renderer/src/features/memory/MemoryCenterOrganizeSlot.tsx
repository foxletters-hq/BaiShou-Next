import React, { useMemo, useState } from 'react'
import type { MemoryReadinessRowId } from '@baishou/shared'
import { MemoryOrganizePanelHost } from './MemoryOrganizePanelHost'
import { MemoryReadinessBar } from './MemoryReadinessBar'
import { useMemoryReadiness } from './useMemoryReadiness'
import styles from './MemoryCenterPage.module.css'

export function MemoryCenterOrganizeSlot(props: {
  onConfigureEmbedding: () => void
  onStartOrganize: () => void
}) {
  const readiness = useMemoryReadiness()
  const [organizeOpen, setOrganizeOpen] = useState(false)
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
          onStartIndex={props.onStartOrganize}
          onStartOrganize={props.onStartOrganize}
          onOpenOrganize={() => setOrganizeOpen(true)}
          pendingEmbedParts={readiness.pendingEmbedParts}
          pendingGraphCount={readiness.pendingGraphCount}
          indexing={readiness.indexing}
          extracting={readiness.graphExtracting}
          organizePipeline={readiness.organizePipeline}
        />
      </div>
      <MemoryOrganizePanelHost
        open={organizeOpen}
        onClose={() => setOrganizeOpen(false)}
        onContinue={() => {
          setOrganizeOpen(false)
          props.onStartOrganize()
        }}
      />
    </>
  )
}
