import React from 'react'
import { useTranslation } from 'react-i18next'
import { Modal } from '../Modal/Modal'
import { Zap, Plus } from 'lucide-react'
import type { PromptShortcut } from './index'
import { useShortcutManagerDialog } from './useShortcutManagerDialog'
import { ShortcutManagerEditForm } from './ShortcutManagerEditForm'
import { ShortcutManagerList } from './ShortcutManagerList'
import { ShortcutSlashHint } from './ShortcutSlashHint'

export interface ShortcutManagerDialogProps {
  isOpen: boolean
  onClose: () => void
  shortcuts: PromptShortcut[]
  onAdd: (shortcut: PromptShortcut) => Promise<void>
  onUpdate: (shortcut: PromptShortcut) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onSelect?: (shortcut: PromptShortcut) => void
}

export const ShortcutManagerDialog: React.FC<ShortcutManagerDialogProps> = ({
  isOpen,
  onClose,
  shortcuts,
  onAdd,
  onUpdate,
  onDelete,
  onSelect
}) => {
  const { t } = useTranslation()
  const mgr = useShortcutManagerDialog(shortcuts, onAdd, onUpdate)

  const handleClose = () => {
    mgr.clearEditing()
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} style={{ padding: '12px 16px 16px' }}>
      <div
        style={{
          width: '600px',
          backgroundColor: 'var(--bg-surface)',
          borderRadius: '16px',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '80vh'
        }}
      >
        <div
          style={{
            padding: '10px 4px 8px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <div
            style={{
              fontWeight: 800,
              fontSize: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}
          >
            <Zap size={18} color="var(--color-primary)" />
            {t('shortcut.manager_title', '快捷指令组合面板')}
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            {!mgr.editingItem && (
              <button
                type="button"
                onClick={mgr.handleCreateNew}
                style={{
                  background: 'var(--color-primary)',
                  color: '#fff',
                  border: 'none',
                  padding: '6px 12px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 13,
                  fontWeight: 600
                }}
              >
                <Plus size={14} /> {t('shortcut.addCustomCommand', '新增自定义指令')}
              </button>
            )}
            <button
              type="button"
              onClick={handleClose}
              style={{
                background: 'var(--bg-surface-high)',
                color: 'var(--text-primary)',
                border: 'none',
                padding: '6px 16px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 600
              }}
            >
              {t('common.back', '返回')}
            </button>
          </div>
        </div>

        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            padding: '0 4px 4px'
          }}
        >
          <div
            style={{
              flex: 1,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              background: 'var(--bg-surface-lowest)',
              borderRadius: '12px',
              overflow: 'hidden'
            }}
          >
            {!mgr.editingItem ? (
              <div style={{ padding: '12px 12px 0' }}>
                <ShortcutSlashHint />
              </div>
            ) : null}

            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: mgr.editingItem ? '16px 12px' : '12px 12px 16px'
              }}
            >
              {mgr.editingItem ? (
                <ShortcutManagerEditForm
                  draftName={mgr.draftName}
                  draftCommand={mgr.draftCommand}
                  draftContent={mgr.draftContent}
                  onDraftNameChange={mgr.setDraftName}
                  onDraftCommandChange={mgr.setDraftCommand}
                  onDraftContentChange={mgr.setDraftContent}
                  onCancel={mgr.clearEditing}
                  onSave={mgr.handleSave}
                />
              ) : (
                <ShortcutManagerList
                  shortcuts={shortcuts}
                  paginatedShortcuts={mgr.paginatedShortcuts}
                  currentPage={mgr.currentPage}
                  totalPages={mgr.totalPages}
                  pageSize={mgr.pageSize}
                  onPageChange={mgr.handlePageChange}
                  onPageSizeChange={mgr.handlePageSizeChange}
                  onSelect={onSelect}
                  onEdit={mgr.handleEdit}
                  onDelete={onDelete}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  )
}
