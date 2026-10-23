import React, { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { BookOpen, ChevronRight } from 'lucide-react'
import type { NotebookMountScope } from '@baishou/shared'
import { useNotebookMount } from './useNotebookMount'
import styles from './KnowledgeMountHint.module.css'

/** 输入区挂载提示：固定在输入框上方的胶囊标签，与移动端视觉保持一致。 */
export function KnowledgeMountHint({
  sessionId,
  assistantId,
  scope,
  refreshToken,
  onOpen,
  className
}: {
  sessionId?: string
  assistantId?: string | null
  scope?: NotebookMountScope
  /** 变化时强制刷新（例如挂载对话框开合） */
  refreshToken?: unknown
  onOpen: () => void
  /** 额外容器类名（用于按页面微调与输入框的间距） */
  className?: string
}) {
  const { t } = useTranslation()
  const mount = useNotebookMount(sessionId, { assistantId, scope })
  const { refresh } = mount
  const skipInitialRefreshRef = useRef(true)

  useEffect(() => {
    if (skipInitialRefreshRef.current) {
      skipInitialRefreshRef.current = false
      return
    }
    void refresh()
  }, [refresh, refreshToken])

  const visibleCount = mount.selected.length > 0 ? mount.selected.length : mount.selectedIds.length
  if (visibleCount === 0) return null

  const names = mount.selected.map((row) => row.name)
  const countLabel = t('agent.mounted_notebooks_count', '已挂载 {{count}} 本', {
    count: visibleCount
  })
  const fullLabel =
    names.length > 0
      ? t('agent.mounted_notebooks', '已挂载 {{names}}', { names: names.join('、') })
      : countLabel

  return (
    <div className={className ? `${styles.row} ${className}` : styles.row}>
      <button
        type="button"
        className={styles.hint}
        onClick={onOpen}
        title={`${fullLabel} · ${t('agent.mounted_notebooks_hint', '点击管理已挂载的知识库笔记本')}`}
        aria-label={fullLabel}
      >
        <BookOpen size={14} strokeWidth={1.75} className={styles.icon} aria-hidden />
        <span className={styles.label}>{countLabel}</span>
        <ChevronRight size={12} strokeWidth={1.75} className={styles.chevron} aria-hidden />
      </button>
    </div>
  )
}
