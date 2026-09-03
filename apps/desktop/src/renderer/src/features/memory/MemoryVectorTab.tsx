import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSettingsPaneApi, useSettingsStore } from '@baishou/store'
import { RagSettingsPane } from '../settings/components/RagSettingsPane'
import { useRagRuntimeBridge } from '../settings/hooks/useRagRuntimeBridge'
import styles from './MemoryCenterPage.module.css'

export const MemoryVectorTab: React.FC<{ highlightBatchEmbed?: boolean }> = ({
  highlightBatchEmbed = false
}) => {
  const { t } = useTranslation()
  const settings = useSettingsPaneApi()
  const ensureConfigForSegment = useSettingsStore((s) => s.ensureConfigForSegment)
  const [ready, setReady] = useState(() => useSettingsStore.getState().isSegmentConfigReady('rag'))

  useRagRuntimeBridge(true)

  useEffect(() => {
    let cancelled = false
    void ensureConfigForSegment('rag').finally(() => {
      if (!cancelled) setReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [ensureConfigForSegment])

  if (!ready) {
    return (
      <div className={styles.vectorLoading} role="status">
        {t('common.loading', '加载中…')}
      </div>
    )
  }

  return (
    <div
      className={`${styles.vectorHost} ${highlightBatchEmbed ? styles.highlightBatchEmbed : ''}`}
    >
      <RagSettingsPane settings={settings} showReadinessBar={false} embedded />
    </div>
  )
}
