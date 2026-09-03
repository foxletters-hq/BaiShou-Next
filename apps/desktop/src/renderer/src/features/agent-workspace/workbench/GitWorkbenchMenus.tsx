import React, { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Input, type GitManagementViewModel } from '@baishou/ui'
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
          disabled={vm.isCommitActionInFlight}
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
        <Input
          fieldSize="small"
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
