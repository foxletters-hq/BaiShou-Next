import i18n from 'i18next'
import { Linking } from 'react-native'
import * as Application from 'expo-application'
import type { SettingsManagerService } from '@baishou/core-mobile'
import {
  fetchReleaseChannelManifest,
  isAppVersionNewer,
  logger,
  releaseTagToPageUrl
} from '@baishou/shared'
import { APP_VERSION_NUMBER } from '../app-version'

const SETTINGS_KEY_AUTO_CHECK = 'updater_auto_check'

export type MobileUpdateStatus = 'idle' | 'checking' | 'available' | 'not_available' | 'error'

export interface MobileUpdateCheckResult {
  status: MobileUpdateStatus
  currentVersion: string
  latestVersion?: string
  /** 安装包直链（优先于 releaseUrl） */
  downloadUrl?: string
  releaseUrl?: string
  error?: string
}

/** @deprecated 使用 @baishou/shared 的 isAppVersionNewer */
export const isVersionNewer = isAppVersionNewer

export class MobileUpdaterService {
  constructor(private settingsManager: SettingsManagerService) {}

  getCurrentVersion(): string {
    return Application.nativeApplicationVersion || APP_VERSION_NUMBER
  }

  async getAutoCheck(): Promise<boolean> {
    const value = await this.settingsManager.get<boolean>(SETTINGS_KEY_AUTO_CHECK)
    return value !== false
  }

  async setAutoCheck(enabled: boolean): Promise<void> {
    await this.settingsManager.set(SETTINGS_KEY_AUTO_CHECK, enabled)
  }

  async checkForUpdates(): Promise<MobileUpdateCheckResult> {
    const currentVersion = this.getCurrentVersion()

    try {
      const manifest = await fetchReleaseChannelManifest()
      const android = manifest.android
      if (!android?.version) {
        throw new Error(
          i18n.t(
            'auto.apps.mobile.src.services.mobile.updater.service.L52',
            'Release channel 缺少 android 条目'
          )
        )
      }

      const latestVersion = android.version
      const downloadUrl = android.downloadUrl
      const releaseUrl = android.tag ? releaseTagToPageUrl(android.tag) : downloadUrl
      const hasUpdate = isAppVersionNewer(latestVersion, currentVersion)

      return {
        status: hasUpdate ? 'available' : 'not_available',
        currentVersion,
        latestVersion,
        downloadUrl,
        releaseUrl
      }
    } catch (e: unknown) {
      logger.warn('[MobileUpdater] check failed:', e as Error)
      return {
        status: 'error',
        currentVersion,
        error: e instanceof Error ? e.message : String(e)
      }
    }
  }

  async openReleaseUrl(url: string): Promise<void> {
    const canOpen = await Linking.canOpenURL(url)
    if (!canOpen) {
      throw new Error(
        i18n.t(
          'auto.apps.mobile.src.services.mobile.updater.service.L80',
          '无法打开下载或发布页链接'
        )
      )
    }
    await Linking.openURL(url)
  }

  async checkOnBootIfEnabled(): Promise<MobileUpdateCheckResult | null> {
    const autoCheck = await this.getAutoCheck()
    if (!autoCheck) return null
    return this.checkForUpdates()
  }
}
