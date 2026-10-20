import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'expo-router'
import { useThrottledFocusRefresh } from '../../../hooks/useThrottledFocusRefresh'
import { useTranslation } from 'react-i18next'
import i18n from 'i18next'
import { useNativeToast, setGlobalFontScale, type UserProfileConfig } from '@baishou/ui/native'
import {
  CHAT_BACKGROUND_BLUR_DEFAULT,
  CHAT_BACKGROUND_OVERLAY_DEFAULT,
  DEFAULT_USER_PROFILE,
  deriveLegacyVaultId,
  GRAPH_SELF_NAME_CONFIGURED_SETTINGS_KEY,
  getUserProfileFromSettings,
  normalizeChatBackgroundBlur,
  normalizeChatBackgroundOverlayOpacity,
  normalizeGraphAwakenNickname,
  normalizeUiFontSizeLevel,
  uiFontSizeScaleFromLevel,
  saveUserProfileToSettings,
  UI_FONT_SIZE_LEVEL_DEFAULT,
  withSummaryPromptLocaleFromUi,
  type SummaryConfig,
  type UserGender,
  type UserProfile
} from '@baishou/shared'
import { useBaishou } from '../../../providers/BaishouProvider'
import { getAgentDbRuntime } from '../../../services/mobile-agent-db-runtime-ref'
import { syncMobileSelfPersonNodeOnRename } from '../../../services/mobile-graph.service'
import { notifyThemeRefresh } from '../../../lib/theme-events'
import { notifyUserProfileRefresh } from '../../../lib/user-profile-refresh-signal'
import {
  invalidateChatBackgroundDisplayCache,
  resolveChatBackgroundForMobileUi
} from '../../../lib/chat-background-display.util'
import { peekAgentUserProfileCache } from '../../../lib/agent-user-profile.util'
import { resolveUserAvatarForMobileUi } from '../../../lib/user-avatar-display.util'
import { ensureDefaultLatteAssistant, syncDefaultLatteAssistantLocale } from '@baishou/core-mobile'
import { resolveAppUiLanguage } from '../../../lib/device-locale'
import type { SettingsProfileSavePayload } from './SettingsProfileHeader'
import { MobileAttachmentManagerService } from '../../../services/mobile-attachment-manager.service'
import { notifyAgentProfileRefresh } from './settings-account-profile.util'
import { isPendingLocalAvatar } from './settings-account-avatar.util'
import { useSettingsVaults } from './useSettingsVaults'

export function useSettingsAccount() {
  const { t } = useTranslation()
  const router = useRouter()
  const { services, dbReady, vaultRevision } = useBaishou()
  const toast = useNativeToast()
  const accountLoadGenRef = useRef(0)
  const {
    vaults,
    activeVault,
    loadVaults,
    handleSwitchVault,
    handleDeleteVault,
    handleCreateVault
  } = useSettingsVaults(services, dbReady, toast, t)

  const [themeMode, setThemeMode] = useState<'system' | 'light' | 'dark'>('system')
  const [seedColor, setSeedColor] = useState('#5BA8F5')
  const [language, setLanguage] = useState('system')
  const [fontSizeLevel, setFontSizeLevel] = useState(UI_FONT_SIZE_LEVEL_DEFAULT)
  const [profile, setProfile] = useState<{
    nickname: string
    birthday?: string | null
    gender?: UserGender | null
    customGender?: string | null
    avatarPath?: string | null
    showIdentityInProfile?: boolean
    shareIdentityWithCompanion?: boolean
  }>(() => {
    const cached = peekAgentUserProfileCache()
    if (!cached) {
      return {
        nickname: '',
        avatarPath: '',
        birthday: null,
        gender: null,
        customGender: null,
        showIdentityInProfile: true,
        shareIdentityWithCompanion: true
      }
    }
    return {
      nickname: cached.nickname || '',
      birthday: cached.birthday ?? null,
      gender: cached.gender ?? null,
      customGender: cached.customGender ?? null,
      avatarPath: cached.avatarPath ?? '',
      showIdentityInProfile: cached.showIdentityInProfile ?? true,
      shareIdentityWithCompanion: cached.shareIdentityWithCompanion ?? true
    }
  })
  const [chatBackgroundPath, setChatBackgroundPath] = useState<string | null>(null)
  const [chatBackgroundBlur, setChatBackgroundBlur] = useState(CHAT_BACKGROUND_BLUR_DEFAULT)
  const [chatBackgroundOverlayOpacity, setChatBackgroundOverlayOpacity] = useState(
    CHAT_BACKGROUND_OVERLAY_DEFAULT
  )
  const [resolvedBackgroundUri, setResolvedBackgroundUri] = useState<string | null>(null)
  const [identityProfile, setIdentityProfile] = useState<UserProfileConfig>({
    nickname: DEFAULT_USER_PROFILE.nickname,
    activePersonaId: DEFAULT_USER_PROFILE.activePersonaId,
    personas: DEFAULT_USER_PROFILE.personas
  })

  const loadAccountSettings = useCallback(async () => {
    if (!dbReady || !services) return
    const loadGen = ++accountLoadGenRef.current
    console.log('[AppearanceLang] load:start', { loadGen })
    try {
      const settings = (await services.settingsManager.get<any>('settings')) || {}
      if (loadGen !== accountLoadGenRef.current) {
        console.log('[AppearanceLang] load:stale-after-settings', {
          loadGen,
          current: accountLoadGenRef.current,
          diskLanguage: settings.language
        })
        return
      }

      const nextThemeMode = settings.themeMode as 'system' | 'light' | 'dark' | undefined
      const nextSeedColor = typeof settings.seedColor === 'string' ? settings.seedColor : undefined
      const nextLanguage = typeof settings.language === 'string' ? settings.language : undefined
      const nextFontSizeLevel = normalizeUiFontSizeLevel(settings.fontSizeLevel)

      const userProfile = await getUserProfileFromSettings(services.settingsManager)
      if (loadGen !== accountLoadGenRef.current) {
        console.log('[AppearanceLang] load:stale-after-profile', {
          loadGen,
          current: accountLoadGenRef.current
        })
        return
      }

      if (userProfile.avatarPath) {
        await resolveUserAvatarForMobileUi(
          userProfile.avatarPath,
          services.attachmentManager,
          services.fileSystem
        )
      }
      if (loadGen !== accountLoadGenRef.current) {
        console.log('[AppearanceLang] load:stale-after-avatar', {
          loadGen,
          current: accountLoadGenRef.current,
          skippedLanguage: nextLanguage
        })
        return
      }

      if (nextThemeMode) {
        setThemeMode((prev) => (prev === nextThemeMode ? prev : nextThemeMode))
      }
      if (nextSeedColor) {
        setSeedColor((prev) => (prev === nextSeedColor ? prev : nextSeedColor))
      }
      setFontSizeLevel((prev) => (prev === nextFontSizeLevel ? prev : nextFontSizeLevel))
      if (nextLanguage) {
        console.log('[AppearanceLang] load:apply-language', {
          loadGen,
          diskLanguage: nextLanguage
        })
        setLanguage((prev) => (prev === nextLanguage ? prev : nextLanguage))
      }

      const nextNickname = userProfile.nickname || ''
      const nextAvatarPath = userProfile.avatarPath
      const nextBirthday = userProfile.birthday ?? null
      const nextGender = userProfile.gender ?? null
      const nextCustomGender = userProfile.customGender ?? null
      const nextShowIdentityInProfile = userProfile.showIdentityInProfile ?? true
      const nextShareIdentityWithCompanion = userProfile.shareIdentityWithCompanion ?? true
      setProfile((prev) =>
        prev.nickname === nextNickname &&
        prev.avatarPath === nextAvatarPath &&
        prev.birthday === nextBirthday &&
        prev.gender === nextGender &&
        prev.customGender === nextCustomGender &&
        prev.showIdentityInProfile === nextShowIdentityInProfile &&
        prev.shareIdentityWithCompanion === nextShareIdentityWithCompanion
          ? prev
          : {
              nickname: nextNickname,
              avatarPath: nextAvatarPath,
              birthday: nextBirthday,
              gender: nextGender,
              customGender: nextCustomGender,
              showIdentityInProfile: nextShowIdentityInProfile,
              shareIdentityWithCompanion: nextShareIdentityWithCompanion
            }
      )
      setChatBackgroundPath(userProfile.chatBackgroundPath ?? null)
      setChatBackgroundBlur(normalizeChatBackgroundBlur(userProfile.chatBackgroundBlur))
      setChatBackgroundOverlayOpacity(
        normalizeChatBackgroundOverlayOpacity(userProfile.chatBackgroundOverlayOpacity)
      )
      setIdentityProfile({
        nickname: userProfile.nickname || '',
        avatarPath: userProfile.avatarPath ?? undefined,
        activePersonaId: userProfile.activePersonaId,
        personas: userProfile.personas,
        recentPersonaIds: userProfile.recentPersonaIds
      })
      console.log('[AppearanceLang] load:done', { loadGen, language: nextLanguage })
    } catch (e) {
      console.warn('[AppearanceLang] load:failed', e)
    }
  }, [dbReady, services])

  const refreshAccountOnFocus = useCallback(() => {
    void loadAccountSettings()
    void loadVaults()
  }, [loadAccountSettings, loadVaults])

  useEffect(() => {
    void loadAccountSettings()
    void loadVaults()
  }, [loadAccountSettings, loadVaults, vaultRevision])

  useThrottledFocusRefresh(refreshAccountOnFocus)

  const handleSaveProfile = async (newProfile: SettingsProfileSavePayload) => {
    if (!services || !dbReady) return
    try {
      const userProfile = await getUserProfileFromSettings(services.settingsManager)
      let avatarPath = newProfile.avatarPath ?? userProfile.avatarPath
      const pendingAvatarUri = newProfile.avatarPath
      if (isPendingLocalAvatar(pendingAvatarUri)) {
        const importedPath = await services.attachmentManager.importAvatar(
          pendingAvatarUri,
          'user_avatar',
          newProfile.avatarSourceByteSize
        )
        avatarPath = importedPath
      }

      const resolvedGender =
        newProfile.gender !== undefined ? newProfile.gender : (userProfile.gender ?? null)
      const resolvedCustomGender =
        resolvedGender === 'other'
          ? newProfile.customGender !== undefined
            ? newProfile.customGender
            : (userProfile.customGender ?? null)
          : null

      const next: UserProfile = {
        ...userProfile,
        nickname: newProfile.nickname,
        birthday:
          newProfile.birthday !== undefined ? newProfile.birthday : (userProfile.birthday ?? null),
        gender: resolvedGender,
        customGender: resolvedCustomGender,
        showIdentityInProfile:
          newProfile.showIdentityInProfile !== undefined
            ? newProfile.showIdentityInProfile
            : (userProfile.showIdentityInProfile ?? true),
        shareIdentityWithCompanion:
          newProfile.shareIdentityWithCompanion !== undefined
            ? newProfile.shareIdentityWithCompanion
            : (userProfile.shareIdentityWithCompanion ?? true),
        avatarPath
      }
      await saveUserProfileToSettings(services.settingsManager, next)
      if (normalizeGraphAwakenNickname(next.nickname)) {
        await services.settingsManager.set(GRAPH_SELF_NAME_CONFIGURED_SETTINGS_KEY, true)
      }
      const runtime = getAgentDbRuntime()
      if (runtime?.drizzleDb) {
        const vaultName = activeVault?.name || 'Personal'
        const vaultId = activeVault?.id ?? deriveLegacyVaultId(vaultName)
        await syncMobileSelfPersonNodeOnRename({
          drizzleDb: runtime.drizzleDb,
          pathService: services.pathService,
          fileSystem: services.fileSystem,
          vaultId,
          vaultDisplayName: vaultName,
          oldName: userProfile.nickname,
          newName: next.nickname
        })
      }
      setProfile({
        nickname: next.nickname,
        avatarPath: next.avatarPath,
        birthday: next.birthday,
        gender: next.gender,
        customGender: next.customGender,
        showIdentityInProfile: next.showIdentityInProfile,
        shareIdentityWithCompanion: next.shareIdentityWithCompanion
      })
      setIdentityProfile((prev) => ({
        ...prev,
        nickname: next.nickname,
        avatarPath: next.avatarPath ?? undefined
      }))
      toast.showSuccess(t('common.save_success'))
      notifyAgentProfileRefresh()
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
      setProfile((prev) => ({
        ...prev,
        nickname: next.nickname,
        avatarPath: next.avatarPath
      }))
      notifyAgentProfileRefresh()
    } catch (e) {
      console.error('Save identity failed', e)
    }
  }

  const persistAppearance = async (
    patch: Record<string, unknown>,
    apply: () => void
  ): Promise<void> => {
    if (!services || !dbReady) return
    try {
      accountLoadGenRef.current += 1
      apply()
      const settings = (await services.settingsManager.get<any>('settings')) || {}
      Object.assign(settings, patch)
      await services.settingsManager.set('settings', settings)
      accountLoadGenRef.current += 1
      notifyThemeRefresh()
    } catch (e) {
      console.error('Save appearance failed', e)
    }
  }

  const handleSaveTheme = async (mode: 'system' | 'light' | 'dark') => {
    await persistAppearance({ themeMode: mode }, () => setThemeMode(mode))
  }

  const handleSeedColorChange = async (color: string) => {
    await persistAppearance({ seedColor: color }, () => setSeedColor(color))
  }

  const handleFontSizeLevelChange = async (level: number) => {
    const next = normalizeUiFontSizeLevel(level)
    const nextScale = uiFontSizeScaleFromLevel(next)
    setFontSizeLevel(next)
    setGlobalFontScale(nextScale)
    notifyThemeRefresh()
    await persistAppearance({ fontSizeLevel: next }, () => setFontSizeLevel(next))
  }

  const handleSaveLanguage = async (lang: string) => {
    if (!services || !dbReady) return
    const prev = language
    try {
      accountLoadGenRef.current += 1
      setLanguage(lang)
      console.log('[AppearanceLang] save:start', {
        from: prev,
        to: lang,
        i18n: i18n.language,
        loadGen: accountLoadGenRef.current
      })
      const settings = (await services.settingsManager.get<any>('settings')) || {}
      settings.language = lang
      await services.settingsManager.set('settings', settings)
      accountLoadGenRef.current += 1
      setLanguage(lang)
      const resolvedLang = resolveAppUiLanguage(lang, i18n.language)
      console.log('[AppearanceLang] save:persisted', {
        preference: lang,
        resolvedLang,
        loadGen: accountLoadGenRef.current
      })
      await i18n.changeLanguage(resolvedLang)
      await ensureDefaultLatteAssistant(services.assistantManager, resolvedLang)
      await syncDefaultLatteAssistantLocale(services.assistantManager, resolvedLang)
      try {
        const summaryConfig =
          (await services.settingsManager.get<SummaryConfig>('summary_config')) || {}
        const {
          config: nextSummary,
          promptLocale,
          changed
        } = withSummaryPromptLocaleFromUi(summaryConfig, resolvedLang)
        if (changed) {
          await services.settingsManager.set('summary_config', nextSummary)
          console.log('[AppearanceLang] summary promptLocale synced', { promptLocale })
        }
      } catch (syncErr) {
        console.warn('[AppearanceLang] summary promptLocale sync failed', syncErr)
      }
      console.log('[AppearanceLang] save:done', { preference: lang, i18n: i18n.language })
    } catch (e) {
      console.error('[AppearanceLang] save:failed', e)
    }
  }

  useEffect(() => {
    if (!chatBackgroundPath || !services) {
      setResolvedBackgroundUri(null)
      return
    }
    let cancelled = false
    void services.attachmentManager
      .resolveBackgroundPath(chatBackgroundPath)
      .then((uri) => {
        if (!cancelled) setResolvedBackgroundUri(uri)
      })
      .catch(() => {
        if (!cancelled) setResolvedBackgroundUri(null)
      })
    return () => {
      cancelled = true
    }
  }, [chatBackgroundPath, services])

  const handlePickBackground = useCallback(async () => {
    if (!services || !dbReady) return
    try {
      const bgPath = await MobileAttachmentManagerService.pickAndImportBackground(
        services.attachmentManager
      )
      if (!bgPath) return
      const userProfile = await getUserProfileFromSettings(services.settingsManager)
      const next: UserProfile = {
        ...userProfile,
        chatBackgroundPath: bgPath
      }
      await saveUserProfileToSettings(services.settingsManager, next)
      setChatBackgroundPath(bgPath)
      invalidateChatBackgroundDisplayCache()
      const resolvedUri = await resolveChatBackgroundForMobileUi(bgPath, services.attachmentManager)
      setResolvedBackgroundUri(resolvedUri)
      toast.showSuccess(t('common.save_success'))
      notifyUserProfileRefresh()
    } catch (e) {
      console.error('Pick background failed', e)
      toast.showError(t('common.errors.save_failed'))
    }
  }, [services, dbReady, t, toast])

  const handleClearBackground = useCallback(async () => {
    if (!services || !dbReady) return
    try {
      const userProfile = await getUserProfileFromSettings(services.settingsManager)
      const next: UserProfile = {
        ...userProfile,
        chatBackgroundPath: null,
        chatBackgroundBlur: CHAT_BACKGROUND_BLUR_DEFAULT,
        chatBackgroundOverlayOpacity: CHAT_BACKGROUND_OVERLAY_DEFAULT
      }
      await saveUserProfileToSettings(services.settingsManager, next)
      setChatBackgroundPath(null)
      setChatBackgroundBlur(CHAT_BACKGROUND_BLUR_DEFAULT)
      setChatBackgroundOverlayOpacity(CHAT_BACKGROUND_OVERLAY_DEFAULT)
      setResolvedBackgroundUri(null)
      toast.showSuccess(t('common.save_success'))
      notifyAgentProfileRefresh({ chatBackgroundChanged: true })
    } catch (e) {
      console.error('Clear background failed', e)
      toast.showError(t('common.errors.save_failed'))
    }
  }, [services, dbReady, t, toast])

  const saveChatBackgroundStyle = useCallback(
    async (patch: { chatBackgroundBlur?: number; chatBackgroundOverlayOpacity?: number }) => {
      if (!services || !dbReady) return
      try {
        const userProfile = await getUserProfileFromSettings(services.settingsManager)
        const next: UserProfile = { ...userProfile, ...patch }
        await saveUserProfileToSettings(services.settingsManager, next)
        if (patch.chatBackgroundBlur !== undefined) {
          setChatBackgroundBlur(normalizeChatBackgroundBlur(patch.chatBackgroundBlur))
        }
        if (patch.chatBackgroundOverlayOpacity !== undefined) {
          setChatBackgroundOverlayOpacity(
            normalizeChatBackgroundOverlayOpacity(patch.chatBackgroundOverlayOpacity)
          )
        }
        notifyAgentProfileRefresh()
      } catch (e) {
        console.error('Save chat background style failed', e)
        toast.showError(t('common.errors.save_failed'))
      }
    },
    [services, dbReady, t, toast]
  )

  return {
    accountReady: dbReady && !!services,
    router,
    themeMode,
    seedColor,
    language,
    fontSizeLevel,
    profile,
    identityProfile,
    vaults,
    activeVault,
    chatBackgroundPath,
    chatBackgroundBlur,
    chatBackgroundOverlayOpacity,
    resolvedBackgroundUri,
    handleSaveProfile,
    handleIdentityChange,
    handleSwitchVault,
    handleDeleteVault,
    handleCreateVault,
    handleSaveTheme,
    handleSeedColorChange,
    handleSaveLanguage,
    handleFontSizeLevelChange,
    handlePickBackground,
    handleClearBackground,
    saveChatBackgroundStyle
  }
}
