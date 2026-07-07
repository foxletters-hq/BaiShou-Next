import React, { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check } from 'lucide-react'
import type { GitManagementViewModel } from '@baishou/ui'
import styles from './GitWorkbenchPanel.module.css'

export function useDismissOnOutsideClick(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) {
        onClose()
      }
    }
    window.addEventListener('mousedown', onPointerDown)
    return () => window.removeEventListener('mousedown', onPointerDown)
  }, [open, onClose])

  return ref
}

export const GitWorkbenchBranchMenu: React.FC<{
  vm: GitManagementViewModel
  open: boolean
  onClose: () => void
  anchorClassName?: string
}> = ({ vm, open, onClose, anchorClassName }) => {
  const { t } = useTranslation()
  const [newBranch, setNewBranch] = useState('')
  const [mergeBranch, setMergeBranch] = useState('')
  const ref = useDismissOnOutsideClick(open, onClose)
  const branch = vm.branchInfo

  if (!open) return null

  return (
    <div className={`${styles.menu} ${anchorClassName ?? ''}`} ref={ref}>
      {(branch?.branches ?? []).map((name) => (
        <div key={name} className={styles.branchRow}>
          <button
            type="button"
            className={`${styles.menuItem} ${name === branch?.current ? styles.menuItemActive : ''}`}
            onClick={() => {
              onClose()
              void vm.handleCheckoutBranch(name)
            }}
          >
            {name === branch?.current ? <Check size={14} /> : <span style={{ width: 14 }} />}
            <span>{name}</span>
          </button>
          {name !== branch?.current ? (
            <button
              type="button"
              className={styles.branchDeleteBtn}
              title={t('workbench.git_delete_branch', '删除分支')}
              onClick={() => void vm.handleDeleteBranch(name)}
            >
              ×
            </button>
          ) : null}
        </div>
      ))}
      <div className={styles.menuDivider} />
      <button
        type="button"
        className={styles.menuItem}
        onClick={() => {
          onClose()
          void vm.handlePublishBranch()
        }}
      >
        {t('workbench.git_publish_branch', '发布当前分支到远程')}
      </button>
      <input
        className={styles.menuInput}
        value={mergeBranch}
        onChange={(event) => setMergeBranch(event.target.value)}
        placeholder={t('workbench.git_merge_branch', '要合并的分支')}
      />
      <button
        type="button"
        className={styles.menuItem}
        disabled={!mergeBranch.trim()}
        onClick={() => {
          onClose()
          void vm.handleMergeBranch(mergeBranch).then(() => setMergeBranch(''))
        }}
      >
        {t('workbench.git_merge', '合并分支')}
      </button>
      <div className={styles.menuDivider} />
      <input
        className={styles.menuInput}
        value={newBranch}
        onChange={(event) => setNewBranch(event.target.value)}
        placeholder={t('workbench.git_new_branch', '新建分支名称')}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && newBranch.trim()) {
            onClose()
            void vm.handleCreateBranch(newBranch).then(() => setNewBranch(''))
          }
        }}
      />
      <button
        type="button"
        className={styles.menuItem}
        disabled={!newBranch.trim()}
        onClick={() => {
          onClose()
          void vm.handleCreateBranch(newBranch).then(() => setNewBranch(''))
        }}
      >
        {t('workbench.git_create_branch', '创建分支')}
      </button>
    </div>
  )
}

export const GitWorkbenchMoreMenu: React.FC<{
  vm: GitManagementViewModel
  open: boolean
  onClose: () => void
  onOpenSettings: () => void
}> = ({ vm, open, onClose, onOpenSettings }) => {
  const { t } = useTranslation()
  const [stashMessage, setStashMessage] = useState('')
  const ref = useDismissOnOutsideClick(open, onClose)

  if (!open) return null

  return (
    <div className={styles.menu} ref={ref}>
      <button
        type="button"
        className={styles.menuItem}
        onClick={() => {
          onClose()
          void vm.handlePull()
        }}
      >
        {t('version_control.pull', '拉取')}
      </button>
      <button
        type="button"
        className={styles.menuItem}
        onClick={() => {
          onClose()
          void vm.handlePush()
        }}
      >
        {t('version_control.push', '推送')}
      </button>
      {vm.unstagedCount > 0 ? (
        <button
          type="button"
          className={styles.menuItem}
          onClick={() => {
            onClose()
            void vm.handleCommitAll()
          }}
        >
          {t('workbench.git_commit_all', '全部提交')}
        </button>
      ) : null}
      <div className={styles.menuDivider} />
      <div className={styles.stashMenuBlock}>
        <input
          className={styles.menuInput}
          value={stashMessage}
          onChange={(event) => setStashMessage(event.target.value)}
          placeholder={t('workbench.git_stash_message', '贮藏说明（可选）')}
          onKeyDown={(event) => event.stopPropagation()}
        />
        <button
          type="button"
          className={styles.menuItem}
          onClick={() => {
            void vm.handleStashPush(stashMessage || undefined).then(() => setStashMessage(''))
          }}
        >
          {t('workbench.git_stash_push', '贮藏所有变更')}
        </button>
      </div>
      {vm.stashList.length > 0 ? (
        <>
          <div className={styles.menuDivider} />
          <div className={styles.menuSectionLabel}>{t('workbench.git_stash', 'Stash')}</div>
          {vm.stashList.map((entry) => (
            <div key={entry.index} className={styles.stashMenuRow}>
              <span className={styles.stashMenuLabel} title={entry.message}>
                {entry.message}
              </span>
              <div className={styles.stashMenuActions}>
                <button
                  type="button"
                  className={styles.stashMenuBtn}
                  onClick={() => void vm.handleStashApply(entry.index)}
                >
                  {t('workbench.git_stash_apply', '应用')}
                </button>
                <button
                  type="button"
                  className={styles.stashMenuBtn}
                  onClick={() => void vm.handleStashPop(entry.index)}
                >
                  {t('workbench.git_stash_pop', '弹出')}
                </button>
                <button
                  type="button"
                  className={styles.stashMenuBtn}
                  onClick={() => void vm.handleStashDrop(entry.index)}
                >
                  {t('common.delete', '删除')}
                </button>
              </div>
            </div>
          ))}
        </>
      ) : null}
      <div className={styles.menuDivider} />
      <button
        type="button"
        className={styles.menuItem}
        onClick={() => {
          onClose()
          onOpenSettings()
        }}
      >
        {t('workbench.git_settings', 'Git 设置')}
      </button>
    </div>
  )
}
