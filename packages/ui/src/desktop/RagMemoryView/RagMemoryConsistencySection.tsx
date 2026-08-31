import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Checkbox } from '../Checkbox/Checkbox'
import type { MemoryConsistencyReport } from './rag-memory.types'
import styles from './RagMemoryView.module.css'

interface RagMemoryConsistencySectionProps {
  onCheckConsistency?: () => Promise<MemoryConsistencyReport>
  onRepairConsistency?: (params: {
    confirmDeleteIds?: string[]
    restoreIds?: string[]
    cleanOrphans?: boolean
  }) => Promise<{ tombstoned: number; restored: number; orphansCleaned: number }>
}

export const RagMemoryConsistencySection: React.FC<RagMemoryConsistencySectionProps> = ({
  onCheckConsistency,
  onRepairConsistency
}) => {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [report, setReport] = useState<MemoryConsistencyReport | null>(null)
  const [selectedMissing, setSelectedMissing] = useState<Set<string>>(new Set())
  const [message, setMessage] = useState<string | null>(null)

  if (!onCheckConsistency) return null

  const runCheck = async () => {
    setBusy(true)
    setMessage(null)
    try {
      const next = await onCheckConsistency()
      setReport(next)
      setSelectedMissing(new Set(next.missing.map((m) => m.id)))
    } finally {
      setBusy(false)
    }
  }

  const toggleMissing = (id: string) => {
    setSelectedMissing((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const statusLine = (() => {
    if (!report) return null
    const missingCount = report.missing.length
    const orphanCount = report.orphans.length
    if (missingCount === 0 && orphanCount === 0) {
      return t(
        'settings.rag_consistency_ok',
        'JSONL 活行 {{jsonl}} 条 · 向量索引 {{vector}} 条 · 一致 ✓',
        { jsonl: report.jsonlLiveCount, vector: report.vectorCount }
      )
    }
    if (missingCount > 0 && orphanCount === 0) {
      return t(
        'settings.rag_consistency_missing',
        'JSONL 活行 {{jsonl}} 条 · 向量索引 {{vector}} 条 · 缺 {{missing}} 条',
        {
          jsonl: report.jsonlLiveCount,
          vector: report.vectorCount,
          missing: missingCount
        }
      )
    }
    if (missingCount === 0 && orphanCount > 0) {
      return t(
        'settings.rag_consistency_orphans',
        'JSONL 活行 {{jsonl}} 条 · 向量索引 {{vector}} 条 · 多 {{orphans}} 条孤儿',
        {
          jsonl: report.jsonlLiveCount,
          vector: report.vectorCount,
          orphans: orphanCount
        }
      )
    }
    return t(
      'settings.rag_consistency_both',
      'JSONL 活行 {{jsonl}} 条 · 向量索引 {{vector}} 条 · 缺 {{missing}} 条 · 多 {{orphans}} 条孤儿',
      {
        jsonl: report.jsonlLiveCount,
        vector: report.vectorCount,
        missing: missingCount,
        orphans: orphanCount
      }
    )
  })()

  return (
    <div className={styles.consistencySection}>
      <button
        type="button"
        className={styles.consistencyToggle}
        onClick={() => {
          const next = !open
          setOpen(next)
          if (next && !report) void runCheck()
        }}
      >
        {t('settings.rag_advanced', '高级')} · {t('settings.rag_consistency_title', '一致性自检')}
      </button>
      {open && (
        <div className={styles.consistencyPanel}>
          <div className={styles.consistencyToolbar}>
            <button
              type="button"
              className={`${styles.actionBtn} ${styles.btnBlueFlat}`}
              disabled={busy}
              onClick={() => void runCheck()}
            >
              {busy
                ? t('common.processing', '处理中')
                : t('settings.rag_consistency_check', '重新检查')}
            </button>
            {report && report.orphans.length > 0 && onRepairConsistency && (
              <button
                type="button"
                className={`${styles.actionBtn} ${styles.btnGreenOutlined}`}
                disabled={busy}
                onClick={() => {
                  void (async () => {
                    setBusy(true)
                    try {
                      const result = await onRepairConsistency({ cleanOrphans: true })
                      setMessage(
                        t(
                          'settings.rag_consistency_orphans_cleaned',
                          '已清理 {{count}} 条孤儿索引',
                          {
                            count: result.orphansCleaned
                          }
                        )
                      )
                      await runCheck()
                    } finally {
                      setBusy(false)
                    }
                  })()
                }}
              >
                {t('settings.rag_consistency_clean_orphans', '清理孤儿')}
              </button>
            )}
          </div>
          {statusLine && <div className={styles.consistencyStatus}>{statusLine}</div>}
          {message && <div className={styles.consistencyMessage}>{message}</div>}
          {report && report.missing.length > 0 && (
            <div className={styles.consistencyMissingBlock}>
              <div className={styles.consistencyMissingHint}>
                {t(
                  'settings.rag_consistency_missing_hint',
                  '以下记忆在 JSONL 中仍为活行，但向量索引缺失。可能是历史删除，也可能是嵌入失败。请逐条选择：'
                )}
              </div>
              <div className={styles.consistencyMissingList}>
                {report.missing.map((item) => (
                  <label key={item.id} className={styles.consistencyMissingItem}>
                    <Checkbox
                      checked={selectedMissing.has(item.id)}
                      onChange={() => toggleMissing(item.id)}
                    />
                    <span className={styles.consistencyMissingText}>
                      {item.content.length > 80 ? `${item.content.slice(0, 80)}…` : item.content}
                    </span>
                  </label>
                ))}
              </div>
              {onRepairConsistency && (
                <div className={styles.consistencyToolbar}>
                  <button
                    type="button"
                    className={`${styles.actionBtn} ${styles.btnGreenOutlined}`}
                    disabled={busy || selectedMissing.size === 0}
                    onClick={() => {
                      void (async () => {
                        setBusy(true)
                        try {
                          const result = await onRepairConsistency({
                            restoreIds: [...selectedMissing]
                          })
                          setMessage(
                            t('settings.rag_consistency_restored', '已恢复索引 {{count}} 条', {
                              count: result.restored
                            })
                          )
                          await runCheck()
                        } finally {
                          setBusy(false)
                        }
                      })()
                    }}
                  >
                    {t('settings.rag_consistency_restore', '恢复索引')}
                  </button>
                  <button
                    type="button"
                    className={`${styles.actionBtn} ${styles.btnDangerOutlined}`}
                    disabled={busy || selectedMissing.size === 0}
                    onClick={() => {
                      void (async () => {
                        setBusy(true)
                        try {
                          const result = await onRepairConsistency({
                            confirmDeleteIds: [...selectedMissing]
                          })
                          setMessage(
                            t(
                              'settings.rag_consistency_tombstoned',
                              '已确认删除（tombstone）{{count}} 条',
                              { count: result.tombstoned }
                            )
                          )
                          await runCheck()
                        } finally {
                          setBusy(false)
                        }
                      })()
                    }}
                  >
                    {t('settings.rag_consistency_confirm_delete', '确认删除')}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
