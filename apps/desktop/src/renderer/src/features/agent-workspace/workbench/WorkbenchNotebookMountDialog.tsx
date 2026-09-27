import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Unlink } from 'lucide-react'
import { Button, Checkbox, Modal } from '@baishou/ui'
import {
  canToggleMountedNotebook,
  getNotebookCardAppearance,
  type NotebookMountCandidate,
  type NotebookMountScope
} from '@baishou/shared'
import { useNotebookMount } from '../../knowledge/useNotebookMount'
import styles from './WorkbenchNotebookMountDialog.module.css'

export interface WorkbenchNotebookMountDialogProps {
  open: boolean
  sessionId?: string
  assistantId?: string | null
  scope?: NotebookMountScope
  onClose: () => void
}

function NotebookMountMark({ notebook }: { notebook: NotebookMountCandidate }) {
  const [imageBroken, setImageBroken] = useState(false)
  useEffect(() => {
    setImageBroken(false)
  }, [notebook.coverImageUrl])
  const appearance = getNotebookCardAppearance(notebook.id, {
    coverTone: notebook.coverTone,
    coverIcon: notebook.coverIcon
  })
  const imageUrl = !imageBroken ? notebook.coverImageUrl : ''
  return (
    <span className={styles.cover} aria-hidden>
      {imageUrl ? (
        <img src={imageUrl} alt="" onError={() => setImageBroken(true)} />
      ) : (
        appearance.icon
      )}
    </span>
  )
}

export const WorkbenchNotebookMountDialog: React.FC<WorkbenchNotebookMountDialogProps> = ({
  open,
  sessionId,
  assistantId,
  scope = 'companion',
  onClose
}) => {
  const { t } = useTranslation()
  const mount = useNotebookMount(open ? sessionId : undefined, { assistantId, scope })
  const { refresh } = mount

  useEffect(() => {
    if (open) void refresh()
  }, [open, refresh])

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title={t('workbench.notebook_mount', '知识库笔记本')}
      containToContentCard
    >
      <div className={styles.body}>
        <div className={styles.statusRow}>
          <div className={styles.statusText}>
            <span className={styles.statusLabel}>
              {t('workbench.mounted_notebooks', '当前挂载')}
            </span>
            {mount.selected.length > 0 ? (
              <span className={styles.mountedList}>
                {mount.selected.map((row) => (
                  <span key={row.id} className={styles.mountedChip}>
                    <NotebookMountMark notebook={row} />
                    <span className={styles.mountedName}>{row.name}</span>
                  </span>
                ))}
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

        {mount.candidates.length === 0 ? (
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
              return (
                <li key={nb.id}>
                  <label
                    className={`${styles.notebookRow} ${selected ? styles.notebookRowActive : ''}`}
                  >
                    <Checkbox
                      checked={selected}
                      disabled={mount.busy || (!selected && !gate.allowed)}
                      onChange={() => void mount.toggle(nb.id)}
                    />
                    <NotebookMountMark notebook={nb} />
                    <span className={styles.notebookCopy}>
                      <span className={styles.notebookName}>{nb.name}</span>
                      <span className={styles.notebookMeta}>
                        {t(
                          'knowledge.notebook_mount_counts',
                          '向量 {{vectors}} · 图谱 {{graphs}}',
                          {
                            vectors: nb.chunks,
                            graphs: nb.graphNodes ?? 0
                          }
                        )}
                      </span>
                      {!selected && gate.reason ? (
                        <span className={styles.notebookWarn}>{gate.reason}</span>
                      ) : null}
                    </span>
                  </label>
                </li>
              )
            })}
          </ul>
        )}

        <div className={styles.footer}>
          <Button type="button" onClick={onClose}>
            {t('common.close', '关闭')}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
