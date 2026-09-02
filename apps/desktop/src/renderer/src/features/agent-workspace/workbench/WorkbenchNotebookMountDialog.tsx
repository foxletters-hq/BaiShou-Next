import React, { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { BookOpen, Unlink, X } from 'lucide-react'
import { Modal } from '@baishou/ui'
import { canToggleMountedNotebook } from '@baishou/shared'
import { useNotebookMount } from '../../knowledge/useNotebookMount'
import styles from './WorkbenchNotebookMountDialog.module.css'

export interface WorkbenchNotebookMountDialogProps {
  open: boolean
  sessionId?: string
  onClose: () => void
}

export const WorkbenchNotebookMountDialog: React.FC<WorkbenchNotebookMountDialogProps> = ({
  open,
  sessionId,
  onClose
}) => {
  const { t } = useTranslation()
  const mount = useNotebookMount(open ? sessionId : undefined)

  useEffect(() => {
    if (open) void mount.refresh()
  }, [open, mount.refresh])

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title={t('workbench.notebook_mount', '知识库笔记本')}
      containToContentCard
    >
      <div className={styles.body}>
        <div className={styles.statusRow}>
          <BookOpen size={16} strokeWidth={1.75} aria-hidden className={styles.icon} />
          <div className={styles.statusText}>
            <span className={styles.statusLabel}>
              {t('workbench.mounted_notebooks', '当前挂载')}
            </span>
            {mount.selected.length > 0 ? (
              <span className={styles.mounted}>
                {mount.selected.map((row) => row.name).join('、')}
              </span>
            ) : (
              <span className={styles.unmounted}>
                {t('workbench.notebook_not_mounted', '未挂载')}
              </span>
            )}
          </div>
          {mount.selected.length > 0 ? (
            <button
              type="button"
              className={styles.actionBtn}
              disabled={mount.busy}
              title={t('workbench.detach_notebook', '取消挂载')}
              onClick={() => void mount.clear()}
            >
              <Unlink size={14} strokeWidth={1.75} aria-hidden />
            </button>
          ) : null}
        </div>

        {mount.error ? <p className={styles.error}>{mount.error}</p> : null}

        <p className={styles.hint}>
          {t('workbench.pick_notebook', '最多挂载 3 本，向量维度必须相同')}
        </p>

        {!sessionId || sessionId === 'new-session' ? (
          <p className={styles.empty}>
            {t('workbench.need_session_for_notebook', '请先打开一个会话')}
          </p>
        ) : mount.candidates.length === 0 ? (
          <p className={styles.empty}>
            {t('workbench.no_notebooks', '暂无笔记本，请先在知识库创建。')}
          </p>
        ) : (
          <ul className={styles.list}>
            {mount.candidates.map((nb) => {
              const selected = mount.selectedIds.includes(nb.id)
              const gate = canToggleMountedNotebook({
                selectedIds: mount.selectedIds,
                candidate: nb,
                candidates: mount.candidates
              })
              const dimLabel =
                nb.dimension != null
                  ? t('workbench.notebook_dimension', '{{count}} 维', { count: nb.dimension })
                  : t('workbench.notebook_no_embed', '尚未嵌入')
              return (
                <li key={nb.id}>
                  <button
                    type="button"
                    className={`${styles.notebookBtn} ${selected ? styles.notebookBtnActive : ''}`}
                    disabled={mount.busy || (!selected && !gate.allowed)}
                    title={!selected && gate.reason ? gate.reason : undefined}
                    onClick={() => void mount.toggle(nb.id)}
                  >
                    <span className={styles.notebookName}>{nb.name}</span>
                    <span className={styles.notebookMeta}>
                      {t('workbench.notebook_sources', '{{count}} 份资料', { count: nb.sources })}
                      {' · '}
                      {dimLabel}
                    </span>
                    {!selected && gate.reason ? (
                      <span className={styles.notebookWarn}>{gate.reason}</span>
                    ) : null}
                  </button>
                </li>
              )
            })}
          </ul>
        )}

        <div className={styles.footer}>
          <button type="button" className={styles.closeBtn} onClick={onClose}>
            <X size={14} strokeWidth={1.75} aria-hidden />
            {t('common.close', '关闭')}
          </button>
        </div>
      </div>
    </Modal>
  )
}
