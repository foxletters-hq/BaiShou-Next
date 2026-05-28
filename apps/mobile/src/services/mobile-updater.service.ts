import { Linking } from 'react-native'
import * as Application from 'expo-application'
import type { SettingsManagerService } from '@baishou/core-mobile'
import { logger } from '@baishou/shared'

const GITHUB_LATEST_URL = 'https://api.github.com/repos/Anson-Trio/BaiShou-Next/releases/latest'
const SETTINGS_KEY_AUTO_CHECK = 'updater_auto_check'

export type MobileUpdateStatus = 'idle' | 'checking' | 'available' | 'not_available' | 'error'

export interface MobileUpdateCheckResult {
  status: MobileUpdateStatus
  currentVersion: string
  latestVersion?: string
  releaseUrl?: string
  error?: string
}

function parseVersionParts(raw: string): number[] {
  return raw
    .trim()
    .replace(/^v+/i, '')
    .split('.')
    .map((part) => {
      const n = parseInt(part.replace(/[^0-9].*$/, ''), 10)
      return Number.isFinite(n) ? n : 0
    })
}

export function isVersionNewer(latest: string, current: string): boolean {
  const a = parseVersionParts(latest)
  const b = parseVersionParts(current)
  const len = Math.max(a.length, b.length)
  for (let i = 0; i < len; i++) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0)
    if (diff !== 0) return diff > 0
  }
  return false
}

export class MobileUpdaterService {
  constructor(private settingsManager: SettingsManagerService) {}

  getCurrentVersion(): string {
    return Application.nativeApplicationVersion || Application.applicationId || '0.0.0'
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
      const response = await fetch(GITHUB_LATEST_URL, {
        headers: { Accept: 'application/vnd.github+json' }
      })

      if (!response.ok) {
        throw new Error(`GitHub API HTTP ${response.status}`)
      }

      const data = (await response.json()) as {
        tag_name?: string
        html_url?: string
      }

      const latestVersion = (data.tag_name || '').replace(/^v/i, '')
      const releaseUrl =
        data.html_url || `https://github.com/Anson-Trio/BaiShou-Next/releases/tag/v${latestVersion}`

      const hasUpdate = latestVersion ? isVersionNewer(latestVersion, currentVersion) : false

      return {
        status: hasUpdate ? 'available' : 'not_available',
        currentVersion,
        latestVersion,
        releaseUrl
      }
    } catch (e: any) {
      logger.warn('[MobileUpdater] check failed:', e as Error)
      return {
        status: 'error',
        currentVersion,
        error: e?.message || String(e)
      }
    }
  }

  async openReleaseUrl(url: string): Promise<void> {
    const canOpen = await Linking.canOpenURL(url)
    if (!canOpen) {
      throw new Error('无法打开发布页链接')
    }
    await Linking.openURL(url)
  }

  async checkOnBootIfEnabled(): Promise<MobileUpdateCheckResult | null> {
    const autoCheck = await this.getAutoCheck()
    if (!autoCheck) return null
    return this.checkForUpdates()
  }
}
