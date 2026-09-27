import React from 'react'
import { useTranslation } from 'react-i18next'
import type { NotebookMountScope } from '@baishou/shared'
import { useNotebookMount } from './useNotebookMount'
import styles from './KnowledgeMountHint.module.css'

/** 输入区挂载条用固定图标，不跟随各笔记本封面。 */
const MOUNTED_NOTEBOOK_HINT_ICON = '🍋'

export function KnowledgeMountHint({
  sessionId,
  assistantId,
  scope,
  onOpen
}: {
  sessionId?: string
  assistantId?: string | null
  scope?: NotebookMountScope
  onOpen: () => void
}) {
  const { t } = useTranslation()
  const mount = useNotebookMount(sessionId, { assistantId, scope })
  if (mount.selected.length === 0) return null
  return (
    <button type="button" className={styles.hint} onClick={onOpen}>
      <span className={styles.icon} aria-hidden>
        {MOUNTED_NOTEBOOK_HINT_ICON}
      </span>
      <span className={styles.label}>
        {t('agent.mounted_notebooks', '已挂载 {{names}}', {
          names: mount.selected.map((row) => row.name).join('、')
        })}
      </span>
    </button>
  )
}
