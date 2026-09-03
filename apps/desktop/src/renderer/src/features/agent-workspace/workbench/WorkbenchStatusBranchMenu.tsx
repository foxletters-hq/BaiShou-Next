import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check } from 'lucide-react'
import { Input } from '@baishou/ui'
import { listCheckoutBranches } from './workbench-git-branch.util'
import styles from './WorkbenchMainPane.module.css'

export interface WorkbenchStatusBranchMenuProps {
  open: boolean
  onClose: () => void
  current?: string
  branches: string[]
  onCheckout: (branch: string) => void
  onCreate: (branch: string) => void
  onPublish: () => void
}

export const WorkbenchStatusBranchMenu: React.FC<WorkbenchStatusBranchMenuProps> = ({
  open,
  onClose,
  current,
  branches,
  onCheckout,
  onCreate,
  onPublish
}) => {
  const { t } = useTranslation()
  const [creating, setCreating] = useState(false)
  const [newBranch, setNewBranch] = useState('')
  const options = listCheckoutBranches(current, branches)

  if (!open) return null

  const submitCreate = () => {
    const name = newBranch.trim()
    if (!name) return
    onClose()
    setCreating(false)
    setNewBranch('')
    onCreate(name)
  }

  return (
    <div className={styles.branchMenu} role="menu">
      {creating ? (
        <div className={styles.branchCreateRow}>
          <Input
            fieldSize="small"
            autoFocus
            value={newBranch}
            onChange={(event) => setNewBranch(event.target.value)}
            placeholder={t('workbench.git_new_branch', '新建分支名称')}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                submitCreate()
              }
              if (event.key === 'Escape') {
                event.preventDefault()
                setCreating(false)
                setNewBranch('')
              }
            }}
          />
          <button
            type="button"
            className={styles.branchMenuItem}
            disabled={!newBranch.trim()}
            onClick={submitCreate}
          >
            {t('workbench.git_create_branch', '创建分支')}
          </button>
        </div>
      ) : (
        <button type="button" className={styles.branchMenuItem} onClick={() => setCreating(true)}>
          {t('workbench.git_create_branch_action', '创建新分支…')}
        </button>
      )}
      <button
        type="button"
        className={styles.branchMenuItem}
        onClick={() => {
          onClose()
          onPublish()
        }}
      >
        {t('workbench.git_publish_branch', '发布当前分支到远程')}
      </button>
      {options.length > 0 ? <div className={styles.branchMenuDivider} /> : null}
      {options.map((option) => (
        <button
          key={option.name}
          type="button"
          className={`${styles.branchMenuItem} ${option.isCurrent ? styles.branchMenuItemCurrent : ''}`}
          disabled={option.isCurrent}
          onClick={() => {
            onClose()
            onCheckout(option.name)
          }}
        >
          <span className={styles.branchMenuCheck}>
            {option.isCurrent ? <Check size={14} /> : null}
          </span>
          <span>{option.name}</span>
        </button>
      ))}
    </div>
  )
}
