import React, { useEffect, useState } from 'react'
import { View, StyleSheet, Alert, ActivityIndicator } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '@baishou/ui/native'
import { useBaishou } from '../../../providers/BaishouProvider'
import { notifyThemeRefresh } from '../../../lib/theme-events'
import i18n from 'i18next'
import { resolveAppUiLanguage } from '../../../lib/device-locale'
import {
  AppearanceSettingsCard,
  IdentitySettingsCard,
  type UserProfileConfig
} from '@baishou/ui/native'
import { SettingsProfileHeader } from './SettingsProfileHeader'

/** 主设置页顶部：头像、昵称、身份卡、外观 */
export const SettingsAccountPanel: React.FC = () => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const { services, dbReady } = useBaishou()

  const [themeMode, setThemeMode] = useState<'system' | 'light' | 'dark'>('system')
  const [seedColor, setSeedColor] = useState('#007AFF')
  const [language, setLanguage] = useState('system')
  const [profile, setProfile] = useState<any>({ nickname: '', avatarPath: '' })
  const [identityProfile, setIdentityProfile] = useState<UserProfileConfig>({
    nickname: '',
    activePersonaId: 'Default',
    personas: { Default: { id: 'Default', facts: {} } }
  })

  useEffect(() => {
    if (!dbReady || !services) return
    const load = async () => {
      try {
        const settings = (await services.settingsManager.get<any>('settings')) || {}
        if (settings.themeMode) setThemeMode(settings.themeMode)
        if (settings.seedColor) setSeedColor(settings.seedColor)
        if (settings.language) setLanguage(settings.language)

        const userProfile = (await services.settingsManager.get<any>('user_profile')) || {}
        setProfile({
          nickname: userProfile.nickname || '',
          avatarPath: userProfile.avatarPath
        })
        setIdentityProfile({
          nickname: userProfile.nickname || '',
          avatarPath: userProfile.avatarPath,
          activePersonaId: userProfile.activePersonaId || 'Default',
          personas: userProfile.personas || {
            Default: { id: 'Default', facts: {} }
          }
        })
      } catch (e) {
        console.warn('Load account settings failed', e)
      }
    }
    void load()
  }, [dbReady, services])

  const handleSaveProfile = async (newProfile: any) => {
    if (!services || !dbReady) return
    try {
      await services.settingsManager.set('user_profile', newProfile)
      setProfile(newProfile)
      Alert.alert(t('common.success'), t('common.save_success'))
    } catch {
      Alert.alert(t('common.error'), t('common.errors.save_failed'))
    }
  }

  const handleIdentityChange = async (newProfile: UserProfileConfig) => {
    if (!services || !dbReady) return
    try {
      setIdentityProfile(newProfile)
      const userProfile = (await services.settingsManager.get<any>('user_profile')) || {}
      userProfile.personas = newProfile.personas
      userProfile.activePersonaId = newProfile.activePersonaId
      userProfile.nickname = newProfile.nickname
      await services.settingsManager.set('user_profile', userProfile)
      setProfile({ ...profile, ...userProfile })
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

  const accountReady = dbReady && !!services

  return (
    <View style={styles.panel}>
      <SettingsProfileHeader
        profile={profile}
        onSave={handleSaveProfile}
        disabled={!accountReady}
      />

      {!accountReady ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <>
          <IdentitySettingsCard profile={identityProfile} onChange={handleIdentityChange} />

          <AppearanceSettingsCard
            themeMode={themeMode}
            seedColor={seedColor}
            language={language as 'system' | 'zh' | 'zh-TW' | 'en' | 'ja'}
            onThemeModeChange={handleSaveTheme}
            onSeedColorChange={handleSeedColorChange}
            onLanguageChange={handleSaveLanguage}
          />
        </>
      )}

      <View
        style={[styles.sectionDivider, { borderColor: colors.borderSubtle }]}
        accessibilityRole="none"
      />
    </View>
  )
}

const styles = StyleSheet.create({
  panel: {
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 12
  },
  sectionDivider: {
    marginTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderStyle: 'dashed'
  },
  loadingRow: {
    alignItems: 'center',
    paddingVertical: 12
  }
})
