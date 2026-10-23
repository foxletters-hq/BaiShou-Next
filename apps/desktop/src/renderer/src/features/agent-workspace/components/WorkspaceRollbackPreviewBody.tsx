import React from 'react'
import { useTranslation } from 'react-i18next'
import type {
  WorkspaceRollbackPathSection,
  WorkspaceRollbackPreviewCopy
} from '../utils/workspace-rollback.util'
import styles from './WorkspaceRollbackPreviewBody.module.css'

export function WorkspaceRollbackPreviewBody(props: {
  intro: string
  copy: WorkspaceRollbackPreviewCopy | null
}) {
  const { t } = useTranslation()
  const { intro, copy } = props

  if (!copy) {
    return (
      <div className={styles.root}>
        <p className={styles.intro}>{intro}</p>
        <p className={styles.scopeNote}>
          {t('round_rollback.scope_note', '仅覆盖本会话中 AI 写工具触及的路径；不能替代版本控制。')}
        </p>
      </div>
    )
  }

  return (
    <div className={styles.root}>
      <p className={styles.intro}>{intro}</p>
      {copy.cascadeNote ? <p className={styles.note}>{copy.cascadeNote}</p> : null}
      {copy.isEmpty ? (
        <p className={styles.empty}>
          {t('round_rollback.preview_no_files', '本轮没有文件改动，只会删除对话记录。')}
        </p>
      ) : null}
      {copy.attributed ? <RollbackPathSection section={copy.attributed} /> : null}
      {copy.extra ? <RollbackPathSection section={copy.extra} /> : null}
      {copy.extra ? null : (
        <p className={styles.scopeNote}>
          {t('round_rollback.scope_note', '仅覆盖本会话中 AI 写工具触及的路径；不能替代版本控制。')}
        </p>
      )}
    </div>
  )
}

function RollbackPathSection({ section }: { section: WorkspaceRollbackPathSection }) {
  const { t } = useTranslation()
  return (
    <section className={styles.section}>
      <p className={styles.sectionLabel}>{section.label}</p>
      <ul className={styles.pathList}>
        {section.paths.map((path) => (
          <li key={path} className={styles.pathItem}>
            {path}
          </li>
        ))}
        {section.moreCount > 0 ? (
          <li className={styles.more}>
            {t('round_rollback.more_files', '另有 {{count}} 个文件…', { count: section.moreCount })}
          </li>
        ) : null}
      </ul>
    </section>
  )
}
