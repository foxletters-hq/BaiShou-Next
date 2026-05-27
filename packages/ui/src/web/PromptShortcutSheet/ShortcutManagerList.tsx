import React from 'react'
import { useTranslation } from 'react-i18next'
import { Terminal, Edit2, Trash2, ChevronLeft, ChevronRight } from 'lucide-react'
import type { PromptShortcut } from './index'
import { PAGE_SIZE_OPTIONS, isDefaultShortcut } from './useShortcutManagerDialog'

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {paginatedShortcuts.map((s) => (
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
          <div style={{ flex: 1, overflow: 'hidden' }} onClick={() => onSelect?.(s)}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 800 }}>
                /{s.command || s.name || s.tag || 'unnamed'}
              </span>
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
                  onClick={() => onEdit(s)}
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
                  onClick={() => onDelete(s.id)}
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
      ))}
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
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: 16,
            padding: '12px 0',
            borderTop: '1px solid var(--border-subtle)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              {t('common.page_size', '每页显示')}:
            </span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              style={{
                padding: '4px 8px',
                borderRadius: '6px',
                border: '1px solid var(--border-subtle)',
                background: 'var(--bg-surface)',
                fontSize: 12,
                cursor: 'pointer'
              }}
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              {t('common.page_info', '{{current}} / {{total}}', {
                current: currentPage,
                total: totalPages
              })}
            </span>
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                type="button"
                onClick={() => onPageChange(currentPage - 1)}
                disabled={currentPage === 1}
                style={{
                  padding: '6px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-subtle)',
                  background: currentPage === 1 ? 'var(--bg-surface-high)' : 'var(--bg-surface)',
                  cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <ChevronLeft size={14} />
              </button>
              <button
                type="button"
                onClick={() => onPageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                style={{
                  padding: '6px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-subtle)',
                  background:
                    currentPage === totalPages ? 'var(--bg-surface-high)' : 'var(--bg-surface)',
                  cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
