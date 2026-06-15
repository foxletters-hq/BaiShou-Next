import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUserProfileStore } from '@baishou/store'
import { useTranslation } from 'react-i18next'
import {
  AppearanceSettingsCard,
  ProfileSettingsCard,
  HotkeySettingsCard,
  WorkspaceSettingsCard,
  StorageSettingsCard,
  IdentitySettingsCard,
  AboutSettingsCard,
  RestoreBlockingOverlay
} from '@baishou/ui'
import { GITHUB_ISSUES_URL, GITHUB_REPO_URL } from '@baishou/shared'
import baishouHeroImg from '@baishou/shared/assets/images/Next-1.0.0-banner.jpg'
import { APP_VERSION } from '../../../../../app-version'
import { useDesktopStorageSettings } from '../hooks/useDesktopStorageSettings'
import { useSettingsScopeNavigation } from '../hooks/useSettingsScopeNavigation'
import styles from './GeneralSettingsPane.module.css'

export const GeneralSettingsPane: React.FC<{ settings: any }> = ({ settings }) => {
  const navigate = useNavigate()
  const settingsNav = useSettingsScopeNavigation()
  const { t } = useTranslation()
  const { profile, loadProfile } = useUserProfileStore() as any
  const [vaults, setVaults] = useState<any[]>([])
  const [activeVault, setActiveVault] = useState<any>(null)
  const [appVersion, setAppVersion] = useState(APP_VERSION)

  const [storageStats, setStorageStats] = useState({
    storageRootPath: 'Loading...',
    sqliteSizeStats: '0 MB',
    vectorDbStats: '0 MB',
    mediaCacheStats: '0 MB'
  })

  const refreshStorageStats = async () => {
    try {
      if ((window as any).api?.storage) {
        const stats = await (window as any).api.storage.getStats()
        if (stats) setStorageStats(stats)
      }
    } catch (e) {
      console.warn('Load storage stats failed', e)
    }
  }

  const storageSettings = useDesktopStorageSettings(refreshStorageStats)

  const loadVaults = useCallback(async () => {
    try {
      const vList = await (window as any).api?.vault?.list()
      const active = await (window as any).api?.vault?.getActive()
      if (vList) setVaults(vList)
      if (active) setActiveVault(active)
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

    void refreshStorageStats()
    fetchVersion()
  }, [loadProfile, loadVaults])

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
                  await (window as any).api?.vault?.switchActive(id)
                  await (window as any).api?.vault?.waitForResync?.()
                  window.location.reload()
                }}
                onDelete={async (id) => await (window as any).api?.vault?.delete(id)}
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
                storageRootPath={storageSettings.storageRootPath || storageStats.storageRootPath}
                sqliteSizeStats={storageStats.sqliteSizeStats}
                vectorDbStats={storageStats.vectorDbStats}
                mediaCacheStats={storageStats.mediaCacheStats}
                onChangeDirectory={storageSettings.handleChangeDirectory}
                onMigrateDirectory={storageSettings.handleMigrateDirectory}
                onClearCache={async () => {
                  await (window as any).api?.storage?.clearCache()
                  if ((window as any).api?.storage) {
                    const s = await (window as any).api.storage.getStats()
                    if (s) setStorageStats(s)
                  }
                }}
                onVacuumDb={async () => {
                  await (window as any).api?.storage?.vacuumDb()
                  if ((window as any).api?.storage) {
                    const s = await (window as any).api.storage.getStats()
                    if (s) setStorageStats(s)
                  }
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
                onOpenFeedback={() => window.api.shell.openExternal(GITHUB_ISSUES_URL)}
                onOpenCompressionTestSession={(sessionId) => navigate(`/chat/${sessionId}`)}
                onOpenOnboarding={() => navigate('/welcome?preview=1')}
              />
            </div>
          </section>
        </div>
      </div>
    </>
  )
}
