import React from 'react'
import { useTranslation } from 'react-i18next'
import { BookOpen } from 'lucide-react'
import type { NotebookMountScope } from '@baishou/shared'
import { useNotebookMount } from './useNotebookMount'
import styles from './KnowledgeMountHint.module.css'

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
      <BookOpen size={12} strokeWidth={1.75} aria-hidden />
      <span>
        {t('agent.mounted_notebooks', '已挂载 {{names}}', {
          names: mount.selected.map((row) => row.name).join('、')
        })}
      </span>
    </button>
  )
}
