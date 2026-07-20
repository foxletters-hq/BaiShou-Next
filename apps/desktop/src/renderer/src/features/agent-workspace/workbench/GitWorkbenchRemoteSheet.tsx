import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import type { GitManagementViewModel } from '@baishou/ui'
import styles from './GitWorkbenchPanel.module.css'

export interface GitWorkbenchRemoteSheetProps {
  vm: GitManagementViewModel
  open: boolean
  onClose: () => void
}

export const GitWorkbenchRemoteSheet: React.FC<GitWorkbenchRemoteSheetProps> = ({
  vm,
  open,
  onClose
}) => {
  const { t } = useTranslation()
  const [userName, setUserName] = useState(vm.userName)
  const [userEmail, setUserEmail] = useState(vm.userEmail)
  const [remoteUrl, setRemoteUrl] = useState(vm.remoteUrl)
  const [remoteBranch, setRemoteBranch] = useState(vm.remoteBranch)
  const [remoteUsername, setRemoteUsername] = useState(vm.remoteUsername)
  const [remoteToken, setRemoteToken] = useState(vm.remoteToken)
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    if (!open) return
    setUserName(vm.userName)
    setUserEmail(vm.userEmail)
    setRemoteUrl(vm.remoteUrl)
    setRemoteBranch(vm.remoteBranch)
    setRemoteUsername(vm.remoteUsername)
    setRemoteToken(vm.remoteToken)
  }, [
    open,
    vm.userName,
    vm.userEmail,
    vm.remoteUrl,
    vm.remoteBranch,
    vm.remoteUsername,
    vm.remoteToken
  ])

  if (!open) return null

  const saveAll = async () => {
    await vm.handleSaveAuthorConfig()
    await vm.handleSaveRemoteConfig()
    onClose()
  }

  return (
    <div className={styles.sheetBackdrop} onClick={onClose}>
      <div className={styles.sheet} onClick={(event) => event.stopPropagation()}>
        <div className={styles.sheetHeader}>
          <h3 className={styles.sheetTitle}>{t('workbench.git_settings', 'Git 设置')}</h3>
          <button type="button" className={styles.iconBtn} onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className={styles.sheetBody}>
          <label className={styles.sheetLabel}>{t('version_control.author_name', '用户名')}</label>
          <input
            className={styles.menuInput}
            value={userName}
            onChange={(event) => {
              setUserName(event.target.value)
              vm.setUserName(event.target.value)
            }}
          />
          <label className={styles.sheetLabel}>{t('version_control.author_email', '邮箱')}</label>
          <input
            className={styles.menuInput}
            value={userEmail}
            onChange={(event) => {
              setUserEmail(event.target.value)
              vm.setUserEmail(event.target.value)
            }}
          />

          <div className={styles.sheetDivider} />

          <label className={styles.sheetLabel}>
            {t('version_control.remote_url', '远程仓库 URL')}
          </label>
          <input
            className={styles.menuInput}
            value={remoteUrl}
            onChange={(event) => {
              setRemoteUrl(event.target.value)
              vm.setRemoteUrl(event.target.value)
            }}
            placeholder="https://github.com/user/repo.git"
          />
          <label className={styles.sheetLabel}>{t('version_control.remote_branch', '分支')}</label>
          <input
            className={styles.menuInput}
            value={remoteBranch}
            onChange={(event) => {
              setRemoteBranch(event.target.value)
              vm.setRemoteBranch(event.target.value)
            }}
          />
          <label className={styles.sheetLabel}>
            {t('version_control.remote_username', '用户名')}
          </label>
          <input
            className={styles.menuInput}
            value={remoteUsername}
            onChange={(event) => {
              setRemoteUsername(event.target.value)
              vm.setRemoteUsername(event.target.value)
            }}
          />
          <label className={styles.sheetLabel}>
            {t('version_control.remote_token', 'Token / 密码')}
          </label>
          <div className={styles.tokenRow}>
            <input
              className={styles.menuInput}
              type={showPassword ? 'text' : 'password'}
              value={remoteToken}
              onChange={(event) => {
                setRemoteToken(event.target.value)
                vm.setRemoteToken(event.target.value)
              }}
            />
            <button
              type="button"
              className={styles.commitMenuBtn}
              onClick={() => setShowPassword((value) => !value)}
            >
              {showPassword ? t('common.hide', '隐藏') : t('common.show', '显示')}
            </button>
          </div>
        </div>

        <div className={styles.sheetFooter}>
          <button
            type="button"
            className={styles.sheetBtn}
            onClick={() => void vm.handleTestRemote()}
          >
            {t('version_control.test_connection', '测试连接')}
          </button>
          <button type="button" className={styles.sheetBtnPrimary} onClick={() => void saveAll()}>
            {t('common.save', '保存')}
          </button>
        </div>
      </div>
    </div>
  )
}
