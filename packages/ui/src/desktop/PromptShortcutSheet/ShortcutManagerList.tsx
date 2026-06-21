import React, { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Terminal, Edit2, Trash2 } from 'lucide-react'
import { PageSizeSelector } from '../PageSizeSelector'
import { Pagination } from '../Pagination'
import styles from './PromptShortcutSheet.module.css'
import {
  getShortcutCommand,
  getDefaultShortcutLabelsFromT,
  localizePromptShortcut
} from '@baishou/shared'
import type { PromptShortcut } from './index'
import { PAGE_SIZE_OPTIONS, isDefaultShortcut } from './useShortcutManagerDialog'
import { useDialog } from '../Dialog'

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
    async (id: string) => {
      const confirmed = await dialog.confirm(
        t('shortcut.delete_confirm', '确定删除这条快捷指令吗？')
      )
      if (confirmed) await onDelete(id)
    },
    [dialog, onDelete, t]
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {paginatedShortcuts.map((raw) => {
        const s = localizePromptShortcut(raw, labels)
        return (
          <div
            key={s.id}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              background: 'var(--bg-surface)',
              padding: '12px 16px',
              borderRadius: '12px',
              border: '1px solid var(--border-subtle)',
              gap: 12
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: '8px',
                background: 'rgba(var(--color-primary-rgb, 91, 168, 245), 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                color: 'var(--color-primary)'
              }}
            >
              {s.icon ? <span style={{ fontSize: 16 }}>{s.icon}</span> : <Terminal size={16} />}
            </div>
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 800 }}>/{getShortcutCommand(s)}</span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                    background: 'var(--bg-surface-high)',
                    padding: '2px 6px',
                    borderRadius: 4
                  }}
                >
                  {s.name || s.tag || t('shortcut.default_tag', '指令')}
                </span>
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--text-secondary)',
                  marginTop: 4,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}
              >
                {s.description || s.content}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', alignSelf: 'center' }}>
              <button
                type="button"
                onClick={() => onSelect?.(s)}
                style={{
                  padding: '6px 12px',
                  background: 'var(--color-primary)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                {t('common.use', '使用')}
              </button>
              {!isDefaultShortcut(s.id) && (
                <>
                  <button
                    type="button"
                    onClick={() => onEdit(raw)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      padding: 4
                    }}
                    title={t('common.edit', '编辑')}
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete(s.id)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#f44336',
                      cursor: 'pointer',
                      padding: 4
                    }}
                    title={t('common.delete', '删除')}
                  >
                    <Trash2 size={16} />
                  </button>
                </>
              )}
            </div>
          </div>
        )
      })}
      {shortcuts.length === 0 && (
        <div
          style={{
            padding: '40px 0',
            textAlign: 'center',
            color: 'var(--text-secondary)',
            fontSize: 13
          }}
        >
          {t('shortcut.no_shortcuts_hint', '暂无任何快捷指令，立即创建一个吧。')}
        </div>
      )}
      {shortcuts.length > 0 && (
        <div className={styles.managerPaginationBar}>
          <span className={styles.managerPaginationInfo}>
            {t('diary.pagination_info', '共 $total 条，第 $page / $pages 页')
              .replace('$total', String(shortcuts.length))
              .replace('$page', String(currentPage))
              .replace('$pages', String(totalPages))}
          </span>
          <div className={styles.managerPaginationControls}>
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
      )}
    </div>
  )
}
