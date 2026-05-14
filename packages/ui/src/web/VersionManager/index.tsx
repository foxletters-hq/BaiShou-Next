import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { 
  MdOutlineSystemUpdate, 
  MdOpenInNew, 
  MdDownload, 
  MdCheckCircle, 
  MdError, 
  MdHourglassEmpty,
  MdUpdate,
  MdHistory,
  MdInfoOutline
} from 'react-icons/md'
import { useUpdaterStore, UpdateStatus } from '@baishou/store'
import '../shared/SettingsListTile.css'
import './VersionManager.css'

export interface VersionManagerProps {
  /** 版本号 */
  version: string
  /** 英雄图片 */
  heroImageSrc?: string
  /** 打开 GitHub 仓库 */
  onOpenGithubHost?: () => void
}

export const VersionManager: React.FC<VersionManagerProps> = ({ 
  version,
  heroImageSrc,
  onOpenGithubHost
}) => {
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
  const [showReleaseNotes, setShowReleaseNotes] = useState(false)

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
        return <MdHourglassEmpty size={24} className="version-status-icon spinning" />
      case UpdateStatus.AVAILABLE:
        return <MdOutlineSystemUpdate size={24} className="version-status-icon available" />
      case UpdateStatus.DOWNLOADING:
        return <MdDownload size={24} className="version-status-icon downloading" />
      case UpdateStatus.DOWNLOADED:
        return <MdCheckCircle size={24} className="version-status-icon downloaded" />
      case UpdateStatus.ERROR:
        return <MdError size={24} className="version-status-icon error" />
      case UpdateStatus.NOT_AVAILABLE:
        return <MdCheckCircle size={24} className="version-status-icon success" />
      default:
        return <MdUpdate size={24} className="version-status-icon" />
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

  const getStatusColor = () => {
    switch (status) {
      case UpdateStatus.AVAILABLE:
        return 'var(--color-primary)'
      case UpdateStatus.DOWNLOADING:
        return 'var(--color-primary)'
      case UpdateStatus.DOWNLOADED:
        return 'var(--color-success, #4caf50)'
      case UpdateStatus.NOT_AVAILABLE:
        return 'var(--color-success, #4caf50)'
      case UpdateStatus.ERROR:
        return 'var(--color-error, #f44336)'
      default:
        return 'var(--text-secondary)'
    }
  }

  const renderActionButton = () => {
    switch (status) {
      case UpdateStatus.CHECKING:
        return (
          <button className="version-action-btn" disabled>
            <MdHourglassEmpty size={16} className="spinning" />
            {t('updater.checking', '检查中...')}
          </button>
        )
      case UpdateStatus.AVAILABLE:
        return (
          <div className="version-action-group">
            <button className="version-action-btn secondary" onClick={handleOpenReleasePage}>
              <MdOpenInNew size={16} />
              {t('updater.view_release', '发布页')}
            </button>
            <button className="version-action-btn primary" onClick={handleDownload}>
              <MdDownload size={16} />
              {t('updater.download', '下载更新')}
            </button>
          </div>
        )
      case UpdateStatus.DOWNLOADING:
        return (
          <div className="version-progress-container">
            <div className="version-progress-bar">
              <div className="version-progress-fill" style={{ width: `${downloadProgress}%` }} />
            </div>
            <span className="version-progress-text">{Math.round(downloadProgress)}%</span>
          </div>
        )
      case UpdateStatus.DOWNLOADED:
        return (
          <button className="version-action-btn primary" onClick={handleInstall}>
            <MdCheckCircle size={16} />
            {t('updater.install', '立即安装')}
          </button>
        )
      case UpdateStatus.NOT_AVAILABLE:
        return (
          <button className="version-action-btn" onClick={handleCheckUpdate} disabled={isChecking}>
            <MdUpdate size={16} />
            {t('updater.check_again', '再次检查')}
          </button>
        )
      case UpdateStatus.ERROR:
        return (
          <button className="version-action-btn" onClick={handleCheckUpdate} disabled={isChecking}>
            <MdUpdate size={16} />
            {t('updater.retry', '重试')}
          </button>
        )
      default:
        return (
          <button className="version-action-btn" onClick={handleCheckUpdate} disabled={isChecking}>
            <MdUpdate size={16} />
            {t('updater.check', '检查更新')}
          </button>
        )
    }
  }

  const renderReleaseNotes = () => {
    if (!updateInfo?.releaseNotes) return null

    return (
      <div className="version-release-notes">
        <div className="version-release-notes-header">
          <MdHistory size={16} />
          <span>{t('updater.release_notes', '更新日志')}</span>
          <button 
            className="version-release-notes-toggle"
            onClick={() => setShowReleaseNotes(!showReleaseNotes)}
          >
            {showReleaseNotes ? t('common.collapse', '收起') : t('common.expand', '展开')}
          </button>
        </div>
        {showReleaseNotes && (
          <div className="version-release-notes-content">
            {updateInfo.releaseNotes}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="version-manager-wrapper">
      {/* 版本信息头部 */}
      <div className="version-header">
        <div className="version-info">
          <div className="version-current">
            <span className="version-label">{t('updater.current_version', '当前版本')}</span>
            <span className="version-number">v{version}</span>
          </div>
          {currentVersion && currentVersion !== version ? (
            <div className="version-latest">
              <span className="version-label">{t('updater.latest_version', '最新版本')}</span>
              <span className="version-number">v{currentVersion}</span>
            </div>
          ) : (
            <div className="version-latest">
              <span className="version-label">{t('updater.latest_version', '最新版本')}</span>
              <span className="version-number" style={{ color: 'var(--text-secondary)', fontFamily: 'inherit', fontWeight: 400 }}>
                {t('updater.not_released', '暂未发布')}
              </span>
            </div>
          )}
        </div>
        {heroImageSrc && (
          <div className="version-hero-image">
            <img src={heroImageSrc} alt="BaiShou" draggable={false} />
          </div>
        )}
      </div>

      {/* 更新状态区域 */}
      <div className="version-status-section">
        <div className="version-status-row">
          <div className="version-status-info">
            {getStatusIcon()}
            <span className="version-status-text" style={{ color: getStatusColor() }}>
              {getStatusText()}
            </span>
          </div>
          <div className="version-actions">
            {renderActionButton()}
          </div>
        </div>

        {/* 进度条（下载时显示） */}
        {status === UpdateStatus.DOWNLOADING && (
          <div className="version-progress-section">
            <div className="version-progress-bar-large">
              <div 
                className="version-progress-fill-large" 
                style={{ width: `${downloadProgress}%` }}
              />
            </div>
            <span className="version-progress-percentage">{Math.round(downloadProgress)}%</span>
          </div>
        )}

        {/* 更新日志 */}
        {renderReleaseNotes()}
      </div>

      {/* 设置区域 */}
      <div className="version-settings-section">
        <div className="version-setting-item">
          <div className="version-setting-info">
            <MdOutlineSystemUpdate size={20} />
            <div className="version-setting-text">
              <span className="version-setting-title">
                {t('updater.auto_check', '自动检查更新')}
              </span>
              <span className="version-setting-desc">
                {t('updater.auto_check_desc', '启动时自动检查是否有新版本')}
              </span>
            </div>
          </div>
          <label className="settings-switch-label">
            <input
              type="checkbox"
              checked={autoCheck}
              onChange={(e) => setAutoCheck(e.target.checked)}
            />
            <span className="settings-switch-slider" />
          </label>
        </div>
      </div>

      {/* 链接区域 */}
      <div className="version-links-section">
        <button className="version-link-item" onClick={onOpenGithubHost}>
          <MdOpenInNew size={16} />
          <span>{t('updater.view_github', '查看 GitHub 仓库')}</span>
        </button>
      </div>
    </div>
  )
}
