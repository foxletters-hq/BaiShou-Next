import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  MdOutlineSystemUpdate,
  MdOpenInNew,
  MdDownload,
  MdCheckCircle,
  MdError,
  MdHourglassEmpty,
  MdUpdate
} from 'react-icons/md'
import { useUpdaterStore, UpdateStatus } from '@baishou/store'
import { formatAppVersion } from '@baishou/shared'
import { useToast } from '../Toast/useToast'
import '../AboutSettingsCard/AboutSettingsCard.css'
import './VersionManager.css'

export interface VersionManagerProps {
  version: string
  onOpenGithubRepo?: () => void | Promise<void>
}

export const VersionManager: React.FC<VersionManagerProps> = ({ version, onOpenGithubRepo }) => {
  const { t } = useTranslation()
  const toast = useToast()
  const displayVersion = formatAppVersion(version)
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
    initIpcListeners
  } = useUpdaterStore()

  const [isChecking, setIsChecking] = useState(false)
  const [hasCheckedOnce, setHasCheckedOnce] = useState(false)

  useEffect(() => {
    loadAutoCheck()
    initIpcListeners()
  }, [loadAutoCheck, initIpcListeners])

  const handleCheckUpdate = async () => {
    setIsChecking(true)
    try {
      const outcome = await checkForUpdates()
      setHasCheckedOnce(true)
      if (outcome?.skipped) {
        toast.showSuccess(t('updater.not_released_toast', 'No published release yet.'), {
          duration: 4000
        })
      }
    } finally {
      setIsChecking(false)
    }
  }

  const latestVersionLabel = () => {
    if (updateInfo?.version) return formatAppVersion(updateInfo.version)
    if (hasCheckedOnce && status === UpdateStatus.NOT_AVAILABLE && currentVersion) {
      return formatAppVersion(currentVersion)
    }
    return t('updater.latest_unreleased', 'Not released yet')
  }

  const statusMessage = () => {
    switch (status) {
      case UpdateStatus.CHECKING:
        return t('updater.checking', 'Checking for updates…')
      case UpdateStatus.AVAILABLE:
        return t('updater.available', 'New version v{{version}} available', {
          version: updateInfo?.version
        })
      case UpdateStatus.DOWNLOADING:
        return t('updater.downloading', 'Downloading {{progress}}%', {
          progress: Math.round(downloadProgress)
        })
      case UpdateStatus.DOWNLOADED:
        return t('updater.downloaded', 'Ready to install')
      case UpdateStatus.NOT_AVAILABLE:
        return t('updater.not_available', 'You are on the latest version')
      case UpdateStatus.ERROR:
        return error || t('updater.error', 'Update check failed')
      default:
        return t('updater.idle', 'Check whether a newer build is available')
    }
  }

  const renderPrimaryAction = () => {
    if (status === UpdateStatus.AVAILABLE) {
      return (
        <button type="button" className="version-primary-btn" onClick={() => downloadUpdate()}>
          <MdDownload size={18} />
          {t('updater.download', 'Download update')}
        </button>
      )
    }
    if (status === UpdateStatus.DOWNLOADED) {
      return (
        <button type="button" className="version-primary-btn" onClick={() => quitAndInstall()}>
          <MdCheckCircle size={18} />
          {t('updater.install', 'Install now')}
        </button>
      )
    }
    return (
      <button
        type="button"
        className="version-outline-btn"
        onClick={handleCheckUpdate}
        disabled={isChecking || status === UpdateStatus.CHECKING}
      >
        {isChecking || status === UpdateStatus.CHECKING ? (
          <MdHourglassEmpty size={18} className="version-spin" />
        ) : (
          <MdUpdate size={18} />
        )}
        {isChecking || status === UpdateStatus.CHECKING
          ? t('updater.checking_short', 'Checking…')
          : hasCheckedOnce
            ? t('updater.check_again', 'Check again')
            : t('updater.check', 'Check for updates')}
      </button>
    )
  }

  const openGithub = () => {
    void onOpenGithubRepo?.()
  }

  return (
    <div className="version-manager">
      <div className="about-section-title">{t('updater.section_title', 'App updates')}</div>

      <div className="version-panel">
        <div className="version-meta-row">
          <span className="version-meta-label">
            {t('updater.current_version', 'Current version')}
          </span>
          <span className="version-meta-value">{displayVersion}</span>
        </div>
        <div className="version-meta-row">
          <span className="version-meta-label">
            {t('updater.latest_version', 'Latest version')}
          </span>
          <span
            className={`version-meta-value ${!updateInfo?.version && !hasCheckedOnce ? 'version-meta-muted' : ''}`}
          >
            {latestVersionLabel()}
          </span>
        </div>

        <div className="version-panel-divider" />

        <div className="version-status-block">
          <div className="version-status-line">
            {status === UpdateStatus.ERROR ? (
              <MdError size={18} className="version-status-icon error" />
            ) : status === UpdateStatus.NOT_AVAILABLE ? (
              <MdCheckCircle size={18} className="version-status-icon ok" />
            ) : status === UpdateStatus.CHECKING || isChecking ? (
              <MdHourglassEmpty size={18} className="version-status-icon version-spin" />
            ) : (
              <MdOutlineSystemUpdate size={18} className="version-status-icon" />
            )}
            <p className="version-status-message">{statusMessage()}</p>
          </div>
          {renderPrimaryAction()}
        </div>

        {status === UpdateStatus.DOWNLOADING && (
          <div className="version-progress-wrap">
            <div className="version-progress-track">
              <div className="version-progress-fill" style={{ width: `${downloadProgress}%` }} />
            </div>
            <span className="version-progress-label">{Math.round(downloadProgress)}%</span>
          </div>
        )}

        <div className="version-panel-divider" />

        <div className="version-auto-row">
          <div className="version-auto-text">
            <span className="version-auto-title">
              {t('updater.auto_check', 'Check for updates automatically')}
            </span>
            <span className="version-auto-desc">
              {t('updater.auto_check_desc', 'Check when the app starts')}
            </span>
          </div>
          <label className="version-toggle-switch">
            <input
              type="checkbox"
              checked={autoCheck}
              onChange={(e) => setAutoCheck(e.target.checked)}
            />
            <span className="version-toggle-slider" />
          </label>
        </div>
      </div>

      {onOpenGithubRepo && (
        <button type="button" className="about-github-btn" onClick={openGithub}>
          <MdOpenInNew size={18} />
          {t('updater.view_github', 'View GitHub repository')}
        </button>
      )}
    </div>
  )
}
