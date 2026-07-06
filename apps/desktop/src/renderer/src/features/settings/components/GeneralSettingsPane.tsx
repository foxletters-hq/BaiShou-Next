import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUserProfileStore, useSettingsStore } from '@baishou/store'
import { useTranslation } from 'react-i18next'
import {
  AppearanceSettingsCard,
  ProfileSettingsCard,
  HotkeySettingsCard,
  WorkspaceSettingsCard,
  StorageSettingsCard,
  IdentitySettingsCard,
  AboutSettingsCard,
  RestoreBlockingOverlay,
  ChatBackgroundSettingsCard,
  useOpenFeedbackChannel
} from '@baishou/ui'
import {
  GITHUB_REPO_URL,
  normalizeChatBackgroundBlur,
  normalizeChatBackgroundOverlayOpacity
} from '@baishou/shared'
import baishouHeroImg from '@baishou/shared/assets/images/Next-1.0.0-banner.jpg'
import { APP_VERSION } from '../../../../../app-version'
import { useDesktopStorageSettings } from '../hooks/useDesktopStorageSettings'
import { useSettingsScopeNavigation } from '../hooks/useSettingsScopeNavigation'
import { switchActiveVault, persistActiveVaultName } from '../../../lib/vault-runtime.util'
import styles from './GeneralSettingsPane.module.css'

export const GeneralSettingsPane: React.FC<{ settings: any }> = ({ settings }) => {
  const navigate = useNavigate()
  const settingsNav = useSettingsScopeNavigation()
  const { t } = useTranslation()
  const {
    profile,
    loadProfile,
    pickAndSaveBackground,
    clearBackground,
    updateChatBackgroundStyle
  } = useUserProfileStore() as any
  const [vaults, setVaults] = useState<any[]>([])
  const [activeVault, setActiveVault] = useState<any>(null)
  const [appVersion, setAppVersion] = useState(APP_VERSION)
  const openFeedback = useOpenFeedbackChannel((url) => {
    void window.api.shell.openExternal(url)
  })

  const storageSettings = useDesktopStorageSettings()
  const ensureConfigKeys = useSettingsStore((s) => s.ensureConfigKeys)

  useEffect(() => {
    const run = () => {
      void ensureConfigKeys(['hotkeyConfig'], { trackGlobalLoading: false })
    }

    if (typeof requestIdleCallback === 'function') {
      const idleId = requestIdleCallback(run, { timeout: 2000 })
      return () => cancelIdleCallback(idleId)
    }

    const timer = window.setTimeout(run, 300)
    return () => window.clearTimeout(timer)
  }, [ensureConfigKeys])

  const loadVaults = useCallback(async () => {
    try {
      const vList = await (window as any).api?.vault?.list()
      const active = await (window as any).api?.vault?.getActive()
      if (vList) setVaults(vList)
      if (active?.name) {
        setActiveVault(active)
        persistActiveVaultName(active.name)
      }
    } catch (e) {
      console.warn('Load vaults failed', e)
    }
  }, [])

  useEffect(() => {
    if (loadProfile) loadProfile()
    void loadVaults()

    const fetchVersion = async () => {
      try {
        const v = await (window as any).api?.updater?.getVersion?.()
        if (v) setAppVersion(String(v).replace(/^v+/i, ''))
      } catch {
        /* keep default */
      }
    }

    fetchVersion()
  }, [loadProfile, loadVaults])

  useEffect(() => {
    const unsub = (window as any).api?.storage?.onRootChanged?.(() => {
      void loadVaults()
    })
    return unsub
  }, [loadVaults])

  const identityProfile = profile || {
    nickname: '',
    avatarPath: '',
    activePersonaId: 'Default',
    personas: { Default: { id: 'Default', facts: {} } }
  }

  return (
    <>
      <RestoreBlockingOverlay
        visible={storageSettings.overlayVisible}
        message={storageSettings.overlayMessage}
        hint={storageSettings.overlayHint}
      />
      <div
        className="settings-pane settings-pane-full"
        style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}
      >
        <div className={styles.container}>
          <section className={styles.cardSection}>
            <div className={styles.cardHeader}>
              <h3 className={styles.cardTitle}>
                {t('settings.general_section_personal', '个人与环境')}
              </h3>
            </div>
            <div className={styles.cardBody}>
              <ProfileSettingsCard
                profile={profile || { nickname: '', avatarPath: '' }}
                onSave={async (p) => {
                  if (typeof window !== 'undefined' && window.electron) {
                    await window.electron.ipcRenderer.invoke('profile:save', p)
                    if (loadProfile) await loadProfile()
                  }
                }}
              />
              <div className={styles.divider} />
              <IdentitySettingsCard
                embedded
                isLast={false}
                profile={identityProfile}
                onChange={async (newProfile) => {
                  if (typeof window !== 'undefined' && window.electron) {
                    await window.electron.ipcRenderer.invoke('profile:save', newProfile)
                    if (loadProfile) await loadProfile()
                  }
                }}
                onManageIdentity={() => settingsNav.goIdentityCards()}
              />
              <div className={styles.divider} />
              <WorkspaceSettingsCard
                embedded
                vaults={
                  vaults.length > 0
                    ? vaults
                    : [{ name: t('common.loading', 'Loading...'), path: '--' }]
                }
                activeVault={activeVault || vaults[0] || null}
                onSwitch={async (id) => {
                  if (id === activeVault?.name) return
                  await switchActiveVault(id)
                  await loadVaults()
                }}
                onDelete={async (id) => {
                  await (window as any).api?.vault?.delete(id)
                  await loadVaults()
                }}
                onCreate={async (name) => {
                  await (window as any).api?.vault?.createDialog(name)
                  const active = await (window as any).api?.vault?.getActive()
                  if (active) setActiveVault(active)
                  window.location.reload()
                }}
                onManageWorkspace={() => settingsNav.goWorkspaces()}
              />
              <div className={styles.divider} />
              <AppearanceSettingsCard
                embedded
                isLast={!settings.hotkeyConfig}
                themeMode={settings.themeMode}
                seedColor={settings.themeColor || '#5BA8F5'}
                language={settings.locale}
                onThemeModeChange={settings.setThemeMode}
                onSeedColorChange={settings.setThemeColor}
                onLanguageChange={settings.setLocale}
              />
              <div className={styles.divider} />
              <ChatBackgroundSettingsCard
                embedded
                isLast={false}
                backgroundPath={profile?.chatBackgroundPath || null}
                blur={normalizeChatBackgroundBlur(profile?.chatBackgroundBlur)}
                overlayOpacity={normalizeChatBackgroundOverlayOpacity(
                  profile?.chatBackgroundOverlayOpacity
                )}
                onPickBackground={() => void pickAndSaveBackground()}
                onClearBackground={() => void clearBackground()}
                onBlurChange={(value) =>
                  void updateChatBackgroundStyle({ chatBackgroundBlur: value })
                }
                onOverlayOpacityChange={(value) =>
                  void updateChatBackgroundStyle({ chatBackgroundOverlayOpacity: value })
                }
              />
              {settings.hotkeyConfig ? (
                <>
                  <div className={styles.divider} />
                  <HotkeySettingsCard
                    config={settings.hotkeyConfig}
                    onChange={(config) => settings.setHotkeyConfig(config)}
                  />
                </>
              ) : null}
            </div>
          </section>

          <section className={styles.cardSection}>
            <div className={styles.cardBody}>
              <StorageSettingsCard
                embedded
                isLast
                storageRootPath={storageSettings.storageRootPath}
                externalJournalsPath={storageSettings.externalJournalsPath}
                externalJournalsDefaultPath={storageSettings.externalJournalsDefaultPath}
                externalJournalsFileCount={storageSettings.externalJournalsFileCount}
                externalJournalsPathAvailable={storageSettings.externalJournalsPathAvailable}
                externalSummariesPath={storageSettings.externalSummariesPath}
                externalSummariesDefaultPath={storageSettings.externalSummariesDefaultPath}
                externalSummariesFileCount={storageSettings.externalSummariesFileCount}
                externalSummariesFileCounts={storageSettings.externalSummariesFileCounts}
                externalSummariesPathAvailable={storageSettings.externalSummariesPathAvailable}
                sqliteSizeStats={storageSettings.sqliteSizeStats}
                vectorDbStats={storageSettings.vectorDbStats}
                mediaCacheStats={storageSettings.mediaCacheStats}
                onChangeDirectory={storageSettings.handleChangeDirectory}
                onMigrateDirectory={storageSettings.handleMigrateDirectory}
                onChangeExternalJournalsDirectory={
                  storageSettings.handleChangeExternalJournalsDirectory
                }
                onClearExternalJournalsDirectory={
                  storageSettings.handleClearExternalJournalsDirectory
                }
                onChangeExternalSummariesDirectory={
                  storageSettings.handleChangeExternalSummariesDirectory
                }
                onClearExternalSummariesDirectory={
                  storageSettings.handleClearExternalSummariesDirectory
                }
                onClearCache={async () => {
                  await (window as any).api?.storage?.clearCache()
                  await storageSettings.refreshStorageInfo({ includeFileCounts: true })
                }}
                onVacuumDb={async () => {
                  await (window as any).api?.storage?.vacuumDb()
                  await storageSettings.refreshStorageInfo({ includeFileCounts: true })
                }}
              />
            </div>
          </section>

          <section className={styles.cardSection}>
            <div className={styles.cardHeader}>
              <h3 className={styles.cardTitle}>{t('settings.general_section_about', '关于')}</h3>
            </div>
            <div className={styles.cardBody}>
              <AboutSettingsCard
                version={appVersion}
                heroImageSrc={baishouHeroImg}
                onOpenGithubRepo={() => window.api.shell.openExternal(GITHUB_REPO_URL)}
                onOpenFeedback={() => void openFeedback()}
                onOpenCompressionTestSession={(sessionId) => navigate(`/chat/${sessionId}`)}
                onOpenOnboarding={() => navigate('/welcome?preview=1')}
                onDemoVaultCreated={async (vaultName) => {
                  await switchActiveVault(vaultName)
                }}
              />
            </div>
          </section>
        </div>
      </div>
    </>
  )
}
