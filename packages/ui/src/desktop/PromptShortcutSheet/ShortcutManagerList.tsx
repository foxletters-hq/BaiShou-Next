import React, { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Edit2, Trash2, CornerDownLeft } from 'lucide-react'
import { PageSizeSelector } from '../PageSizeSelector'
import { Pagination } from '../Pagination'
import {
  getShortcutCommand,
  getDefaultShortcutLabelsFromT,
  localizePromptShortcut
} from '@baishou/shared'
import type { PromptShortcut } from './index'
import { PAGE_SIZE_OPTIONS, isProtectedSkill } from './useShortcutManagerDialog'
import { useDialog } from '../Dialog'
import styles from './ShortcutManagerDialog.module.css'

interface ShortcutManagerListProps {
  shortcuts: PromptShortcut[]
  paginatedShortcuts: PromptShortcut[]
  currentPage: number
  totalPages: number
  pageSize: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
  onSelect?: (shortcut: PromptShortcut) => void
  onEdit: (shortcut: PromptShortcut) => void
  onDelete: (id: string) => Promise<void>
}

export const ShortcutManagerList: React.FC<ShortcutManagerListProps> = ({
  shortcuts,
  paginatedShortcuts,
  currentPage,
  totalPages,
  pageSize,
  onPageChange,
  onPageSizeChange,
  onSelect,
  onEdit,
  onDelete
}) => {
  const { t } = useTranslation()
  const dialog = useDialog()
  const labels = getDefaultShortcutLabelsFromT(t)

  const handleDelete = useCallback(
    async (item: PromptShortcut) => {
      if (isProtectedSkill(item)) return
      const confirmed = await dialog.confirm(
        t('shortcut.delete_confirm', '确定删除这条 Skill 吗？')
      )
      if (confirmed) await onDelete(item.id)
    },
    [dialog, onDelete, t]
  )

  if (shortcuts.length === 0) {
    return (
      <div className={styles.empty}>
        {t('shortcut.no_shortcuts_hint', '暂无任何快捷指令，立即创建一个吧。')}
      </div>
    )
  }

  return (
    <div>
      <div className={styles.list}>
        {paginatedShortcuts.map((raw) => {
          const s = localizePromptShortcut(raw, labels)
          const command = getShortcutCommand(s)
          const name = (s.name || s.tag || '').trim()
          const protectedSkill = isProtectedSkill(raw)
          return (
            <div key={s.id} className={styles.row}>
              <div className={styles.rowMain}>
                <div className={styles.rowTitle}>
                  <span className={styles.command}>/{command}</span>
                  {name && name.toLowerCase() !== command.toLowerCase() ? (
                    <span className={styles.name}>{name}</span>
                  ) : null}
                </div>
                {(s.description || s.content) && (
                  <div className={styles.desc}>{s.description || s.content}</div>
                )}
              </div>
              <div className={styles.rowActions}>
                {onSelect ? (
                  <button
                    type="button"
                    className={styles.iconBtn}
                    onClick={() => onSelect(s)}
                    title={t('common.use', '使用')}
                    aria-label={t('common.use', '使用')}
                  >
                    <CornerDownLeft size={15} />
                  </button>
                ) : null}
                {!protectedSkill ? (
                  <>
                    <button
                      type="button"
                      className={styles.iconBtn}
                      onClick={() => onEdit(raw)}
                      title={t('common.edit', '编辑')}
                      aria-label={t('common.edit', '编辑')}
                    >
                      <Edit2 size={15} />
                    </button>
                    <button
                      type="button"
                      className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                      onClick={() => void handleDelete(raw)}
                      title={t('common.delete', '删除')}
                      aria-label={t('common.delete', '删除')}
                    >
                      <Trash2 size={15} />
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>

      <div className={styles.paginationBar}>
        <span className={styles.paginationInfo}>
          {t('diary.pagination_info', '共 $total 条，第 $page / $pages 页')
            .replace('$total', String(shortcuts.length))
            .replace('$page', String(currentPage))
            .replace('$pages', String(totalPages))}
        </span>
        <div className={styles.paginationControls}>
          <PageSizeSelector
            value={pageSize}
            options={[...PAGE_SIZE_OPTIONS]}
            onChange={onPageSizeChange}
            label={t('diary.per_page', '条/页')}
          />
          <Pagination
            current={currentPage}
            total={totalPages}
            onChange={onPageChange}
            siblingCount={1}
            showJumper
            jumperPlaceholder={t('common.pagination_jump_placeholder', 'Go to')}
          />
        </div>
      </div>
    </div>
  )
}
