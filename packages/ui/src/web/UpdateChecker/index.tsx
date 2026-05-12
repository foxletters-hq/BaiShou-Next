import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MdOutlineSystemUpdate, MdOpenInNew, MdDownload, MdCheckCircle, MdError, MdHourglassEmpty } from 'react-icons/md'
import { useUpdaterStore, UpdateStatus } from '@baishou/store'
import '../shared/SettingsListTile.css'
import './UpdateChecker.css'

export interface UpdateCheckerProps {
  /** 自定义版本号显示 */
  version?: string
}

export const UpdateChecker: React.FC<UpdateCheckerProps> = ({ version }) => {
  const { t } = useTranslation()
  const {
    status,
    currentVersion,
    updateInfo,
    downloadProgress,
    error,
    autoCheck,
    checkForUpdates,
    downloadUpdate,
    quitAndInstall,
    setAutoCheck,
    loadAutoCheck,
    initIpcListeners,
  } = useUpdaterStore()

  const [isChecking, setIsChecking] = useState(false)

  useEffect(() => {
    loadAutoCheck()
    initIpcListeners()
  }, [loadAutoCheck, initIpcListeners])

  const handleCheckUpdate = async () => {
    setIsChecking(true)
    try {
      await checkForUpdates()
    } finally {
      setIsChecking(false)
    }
  }

  const handleDownload = async () => {
    await downloadUpdate()
  }

  const handleInstall = () => {
    quitAndInstall()
  }

  const handleOpenReleasePage = () => {
    if (updateInfo?.releaseUrl) {
      window.open(updateInfo.releaseUrl, '_blank')
    }
  }

  const getStatusIcon = () => {
    switch (status) {
      case UpdateStatus.CHECKING:
        return <MdHourglassEmpty size={20} className="update-status-icon spinning" />
      case UpdateStatus.AVAILABLE:
        return <MdOutlineSystemUpdate size={20} className="update-status-icon available" />
      case UpdateStatus.DOWNLOADING:
        return <MdDownload size={20} className="update-status-icon downloading" />
      case UpdateStatus.DOWNLOADED:
        return <MdCheckCircle size={20} className="update-status-icon downloaded" />
      case UpdateStatus.ERROR:
        return <MdError size={20} className="update-status-icon error" />
      default:
        return <MdOutlineSystemUpdate size={20} className="update-status-icon" />
    }
  }

  const getStatusText = () => {
    switch (status) {
      case UpdateStatus.CHECKING:
        return t('updater.checking', '检查更新中...')
      case UpdateStatus.AVAILABLE:
        return t('updater.available', '发现新版本 v{{version}}', { version: updateInfo?.version })
      case UpdateStatus.DOWNLOADING:
        return t('updater.downloading', '下载中 {{progress}}%', { progress: Math.round(downloadProgress) })
      case UpdateStatus.DOWNLOADED:
        return t('updater.downloaded', '下载完成，准备安装')
      case UpdateStatus.NOT_AVAILABLE:
        return t('updater.not_available', '已是最新版本')
      case UpdateStatus.ERROR:
        return error || t('updater.error', '检查更新失败')
      default:
        return t('updater.idle', '检查应用更新')
    }
  }

  const renderActionButton = () => {
    switch (status) {
      case UpdateStatus.CHECKING:
        return (
          <button className="update-action-btn" disabled>
            {t('updater.checking', '检查中...')}
          </button>
        )
      case UpdateStatus.AVAILABLE:
        return (
          <div className="update-action-group">
            <button className="update-action-btn secondary" onClick={handleOpenReleasePage}>
              <MdOpenInNew size={16} />
              {t('updater.view_release', '查看发布页')}
            </button>
            <button className="update-action-btn primary" onClick={handleDownload}>
              <MdDownload size={16} />
              {t('updater.download', '下载更新')}
            </button>
          </div>
        )
      case UpdateStatus.DOWNLOADING:
        return (
          <div className="update-progress-bar">
            <div className="update-progress-fill" style={{ width: `${downloadProgress}%` }} />
            <span className="update-progress-text">{Math.round(downloadProgress)}%</span>
          </div>
        )
      case UpdateStatus.DOWNLOADED:
        return (
          <button className="update-action-btn primary" onClick={handleInstall}>
            <MdCheckCircle size={16} />
            {t('updater.install', '立即安装')}
          </button>
        )
      case UpdateStatus.NOT_AVAILABLE:
        return (
          <button className="update-action-btn" onClick={handleCheckUpdate} disabled={isChecking}>
            {t('updater.check_again', '再次检查')}
          </button>
        )
      case UpdateStatus.ERROR:
        return (
          <button className="update-action-btn" onClick={handleCheckUpdate} disabled={isChecking}>
            {t('updater.retry', '重试')}
          </button>
        )
      default:
        return (
          <button className="update-action-btn" onClick={handleCheckUpdate} disabled={isChecking}>
            {t('updater.check', '检查更新')}
          </button>
        )
    }
  }

  return (
    <div className="update-checker-wrapper">
      <div className="settings-list-tile">
        <div className="settings-list-tile-leading">{getStatusIcon()}</div>
        <div className="settings-list-tile-content">
          <span className="settings-list-tile-title">{getStatusText()}</span>
          {version && (
            <span className="settings-list-tile-subtitle">
              {t('updater.current_version', '当前版本')}: v{version}
            </span>
          )}
          {currentVersion && !version && (
            <span className="settings-list-tile-subtitle">
              {t('updater.current_version', '当前版本')}: v{currentVersion}
            </span>
          )}
        </div>
        <div className="update-action-area">{renderActionButton()}</div>
      </div>

      <div className="settings-list-divider" />

      <div className="settings-list-tile">
        <div className="settings-list-tile-leading">
          <MdOutlineSystemUpdate size={24} />
        </div>
        <div className="settings-list-tile-content">
          <span className="settings-list-tile-title">
            {t('updater.auto_check', '自动检查更新')}
          </span>
          <span className="settings-list-tile-subtitle">
            {t('updater.auto_check_desc', '启动时自动检查是否有新版本')}
          </span>
        </div>
        <label className="update-toggle-switch">
          <input
            type="checkbox"
            checked={autoCheck}
            onChange={(e) => setAutoCheck(e.target.checked)}
          />
          <span className="update-toggle-slider" />
        </label>
      </div>
    </div>
  )
}
