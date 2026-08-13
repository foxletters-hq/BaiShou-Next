import React from 'react'
import { useTranslation } from 'react-i18next'
import { Modal } from '../Modal/Modal'
import { Sparkles, Plus, X } from 'lucide-react'
import type { PromptShortcut } from './index'
import { useShortcutManagerDialog } from './useShortcutManagerDialog'
import { ShortcutManagerEditForm } from './ShortcutManagerEditForm'
import { ShortcutManagerList } from './ShortcutManagerList'
import { ShortcutSlashHint } from './ShortcutSlashHint'
import styles from './ShortcutManagerDialog.module.css'

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

  const title = mgr.editingItem
    ? mgr.editingItem.id
      ? t('shortcut.edit_skill', '编辑 Skill')
      : t('shortcut.addCustomCommand', '新增 Skill')
    : t('shortcut.manager_title', 'Skill 管理')

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      closeOnOverlayClick
      zIndex={1200}
      overlayClassName={styles.overlay}
      className={styles.modal}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className={styles.panel}>
        <header className={styles.header}>
          <Sparkles size={16} className={styles.headerIcon} aria-hidden />
          <h2 className={styles.title}>{title}</h2>
          <div className={styles.headerActions}>
            {!mgr.editingItem ? (
              <button
                type="button"
                className={styles.headerBtn}
                onClick={mgr.handleCreateNew}
              >
                <Plus size={14} aria-hidden />
                {t('shortcut.addCustomCommand', '新增 Skill')}
              </button>
            ) : null}
            <button
              type="button"
              className={styles.close}
              onClick={handleClose}
              aria-label={t('common.close', '关闭')}
            >
              <X size={16} />
            </button>
          </div>
        </header>

        <div className={styles.body}>
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
            <>
              <ShortcutSlashHint className={styles.hint} />
              <ShortcutManagerList
                shortcuts={mgr.managerShortcuts}
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
            </>
          )}
        </div>
      </div>
    </Modal>
  )
}
