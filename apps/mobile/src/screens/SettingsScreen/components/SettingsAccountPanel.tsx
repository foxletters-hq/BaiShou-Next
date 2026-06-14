import React, { useCallback, useEffect, useState } from 'react'
import { View, StyleSheet, ActivityIndicator } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import * as Clipboard from 'expo-clipboard'
import { useTranslation } from 'react-i18next'
import i18n from 'i18next'
import {
  useNativeTheme,
  useNativeToast,
  McpSettingsCard,
  SettingsGroupDivider,
  AppearanceSettingsCard,
  IdentitySettingsCard,
  WorkspaceSettingsCard,
  type UserProfileConfig,
  type VaultInfo
} from '@baishou/ui/native'
import {
  DEFAULT_USER_PROFILE,
  getUserProfileFromSettings,
  saveUserProfileToSettings,
  type UserProfile
} from '@baishou/shared'
import { useBaishou } from '../../../providers/BaishouProvider'
import { useMobileMcpConfig } from '../../../hooks/useMobileMcpConfig'
import { notifyThemeRefresh } from '../../../lib/theme-events'
import { resolveAppUiLanguage } from '../../../lib/device-locale'
import { SettingsProfileHeader } from './SettingsProfileHeader'

export interface QuickSettingsGroupProps {
  groupCardStyle: object
}

/** 快捷设置分组卡片内容（用户 / 身份卡 / 外观 / MCP） */
export const QuickSettingsGroup: React.FC<QuickSettingsGroupProps> = ({ groupCardStyle }) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const router = useRouter()
  const { services, dbReady, vaultRevision } = useBaishou()
  const toast = useNativeToast()
  const mcp = useMobileMcpConfig()

  const [themeMode, setThemeMode] = useState<'system' | 'light' | 'dark'>('system')
  const [seedColor, setSeedColor] = useState('#5BA8F5')
  const [language, setLanguage] = useState('system')
  const [profile, setProfile] = useState<any>({ nickname: '', avatarPath: '' })
  const [identityProfile, setIdentityProfile] = useState<UserProfileConfig>({
    nickname: DEFAULT_USER_PROFILE.nickname,
    activePersonaId: DEFAULT_USER_PROFILE.activePersonaId,
    personas: DEFAULT_USER_PROFILE.personas
  })

  const [vaults, setVaults] = useState<VaultInfo[]>([])
  const [activeVault, setActiveVault] = useState<VaultInfo | null>(null)

  const loadVaults = useCallback(async () => {
    if (!services || !dbReady) return
    try {
      const allVaults = await services.vaultService.getAllVaults()
      const active = await services.vaultService.getActiveVault()
      setVaults(
        allVaults.map((v) => ({
          name: v.name,
          path: v.path,
          createdAt: v.createdAt,
          lastAccessedAt: v.lastAccessedAt
        }))
      )
      if (active) {
        setActiveVault({
          name: active.name,
          path: active.path,
          createdAt: active.createdAt,
          lastAccessedAt: active.lastAccessedAt
        })
      } else {
        setActiveVault(null)
      }
    } catch (e) {
      console.warn('Load vaults failed', e)
    }
  }, [dbReady, services])

  const handleSwitchVault = async (name: string) => {
    if (!services || !dbReady) return
    if (activeVault?.name === name) return
    try {
      await services.switchVault(name)
      await loadVaults()
      toast.showSuccess(t('common.save_success'))
    } catch {
      toast.showError(t('common.errors.save_failed'))
    }
  }

  const handleDeleteVault = async (name: string) => {
    if (!services || !dbReady) return
    try {
      await services.deleteVault(name)
      await loadVaults()
    } catch {
      toast.showError(t('common.errors.save_failed'))
    }
  }

  const handleCreateVault = async (name: string) => {
    if (!services || !dbReady) return
    await services.switchVault(name)
    await loadVaults()
  }

  const loadAccountSettings = useCallback(async () => {
    if (!dbReady || !services) return
    try {
      const settings = (await services.settingsManager.get<any>('settings')) || {}
      if (settings.themeMode) setThemeMode(settings.themeMode)
      if (settings.seedColor) setSeedColor(settings.seedColor)
      if (settings.language) setLanguage(settings.language)

      const userProfile = await getUserProfileFromSettings(services.settingsManager)
      setProfile({
        nickname: userProfile.nickname || '',
        avatarPath: userProfile.avatarPath
      })
      setIdentityProfile({
        nickname: userProfile.nickname || '',
        avatarPath: userProfile.avatarPath ?? undefined,
        activePersonaId: userProfile.activePersonaId,
        personas: userProfile.personas,
        recentPersonaIds: userProfile.recentPersonaIds
      })
    } catch (e) {
      console.warn('Load account settings failed', e)
    }
  }, [dbReady, services, vaultRevision])

  useEffect(() => {
    void loadAccountSettings()
    void loadVaults()
  }, [loadAccountSettings, loadVaults])

  useFocusEffect(
    useCallback(() => {
      void loadAccountSettings()
      void loadVaults()
    }, [loadAccountSettings, loadVaults])
  )

  const handleSaveProfile = async (newProfile: {
    nickname: string
    avatarPath?: string | null
  }) => {
    if (!services || !dbReady) return
    try {
      const userProfile = await getUserProfileFromSettings(services.settingsManager)
      const next: UserProfile = {
        ...userProfile,
        nickname: newProfile.nickname,
        avatarPath: newProfile.avatarPath ?? userProfile.avatarPath
      }
      await saveUserProfileToSettings(services.settingsManager, next)
      setProfile({ nickname: next.nickname, avatarPath: next.avatarPath })
      setIdentityProfile((prev) => ({
        ...prev,
        nickname: next.nickname,
        avatarPath: next.avatarPath ?? undefined
      }))
      toast.showSuccess(t('common.save_success'))
    } catch {
      toast.showError(t('common.errors.save_failed'))
    }
  }

  const handleIdentityChange = async (newProfile: UserProfileConfig) => {
    if (!services || !dbReady) return
    try {
      setIdentityProfile(newProfile)
      const userProfile = await getUserProfileFromSettings(services.settingsManager)
      const next: UserProfile = {
        ...userProfile,
        nickname: newProfile.nickname,
        avatarPath: newProfile.avatarPath ?? userProfile.avatarPath ?? null,
        personas: newProfile.personas,
        activePersonaId: newProfile.activePersonaId,
        recentPersonaIds: newProfile.recentPersonaIds
      }
      await saveUserProfileToSettings(services.settingsManager, next)
      setProfile({ nickname: next.nickname, avatarPath: next.avatarPath })
    } catch (e) {
      console.error('Save identity failed', e)
    }
  }

  const handleSaveTheme = async (mode: 'system' | 'light' | 'dark') => {
    if (!services || !dbReady) return
    try {
      setThemeMode(mode)
      const settings = (await services.settingsManager.get<any>('settings')) || {}
      settings.themeMode = mode
      await services.settingsManager.set('settings', settings)
      notifyThemeRefresh()
    } catch (e) {
      console.error('Save theme failed', e)
    }
  }

  const handleSeedColorChange = async (color: string) => {
    if (!services || !dbReady) return
    try {
      setSeedColor(color)
      const settings = (await services.settingsManager.get<any>('settings')) || {}
      settings.seedColor = color
      await services.settingsManager.set('settings', settings)
      notifyThemeRefresh()
    } catch (e) {
      console.error('Save seed color failed', e)
    }
  }

  const handleSaveLanguage = async (lang: string) => {
    if (!services || !dbReady) return
    try {
      setLanguage(lang)
      const settings = (await services.settingsManager.get<any>('settings')) || {}
      settings.language = lang
      await services.settingsManager.set('settings', settings)
      await i18n.changeLanguage(resolveAppUiLanguage(lang, i18n.language))
    } catch (e) {
      console.error('Save language failed', e)
    }
  }

  const handleCopyMcpEndpoint = async () => {
    try {
      await Clipboard.setStringAsync(mcp.mcpEndpointUrl)
      toast.showSuccess(t('common.copied'))
    } catch {
      toast.showError(t('common.copy_failed'))
    }
  }

  const accountReady = dbReady && !!services

  return (
    <View style={[styles.groupCard, groupCardStyle]}>
      <SettingsProfileHeader
        profile={profile}
        onSave={handleSaveProfile}
        disabled={!accountReady}
        embedded
      />

      {!accountReady ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <>
          <IdentitySettingsCard
            embedded
            profile={identityProfile}
            onChange={handleIdentityChange}
            onManageIdentity={() => router.push('/settings/identity-cards')}
          />
          <SettingsGroupDivider />
          <WorkspaceSettingsCard
            embedded
            vaults={vaults}
            activeVault={activeVault}
            onSwitch={handleSwitchVault}
            onDelete={handleDeleteVault}
            onCreate={handleCreateVault}
            onManageWorkspace={() => router.push('/settings/workspaces')}
          />
          <SettingsGroupDivider />
          <AppearanceSettingsCard
            embedded
            themeMode={themeMode}
            seedColor={seedColor}
            language={language as 'system' | 'zh' | 'zh-TW' | 'en' | 'ja'}
            onThemeModeChange={handleSaveTheme}
            onSeedColorChange={handleSeedColorChange}
            onLanguageChange={handleSaveLanguage}
          />
          {!mcp.loading ? (
            <>
              <SettingsGroupDivider />
              <McpSettingsCard
                embedded
                isLast
                config={mcp.config}
                mcpEndpointUrl={mcp.mcpEndpointUrl}
                applying={mcp.applying}
                isRunning={mcp.isRunning}
                activePort={mcp.activePort}
                onChange={(next) => void mcp.persistConfig(next)}
                onCopyEndpoint={() => void handleCopyMcpEndpoint()}
                onShowTools={() => void mcp.showToolsDialog()}
              />
            </>
          ) : null}
        </>
      )}
    </View>
  )
}

/** @deprecated 使用 QuickSettingsGroup + SettingsScreen 统一布局 */
export const SettingsAccountPanel = QuickSettingsGroup

const styles = StyleSheet.create({
  groupCard: {
    overflow: 'hidden'
  },
  loadingRow: {
    alignItems: 'center',
    paddingVertical: 16
  }
})
