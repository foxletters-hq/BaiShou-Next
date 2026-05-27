import React, { useState, useEffect } from 'react'
import { useUserProfileStore } from '@baishou/store'
import { useTranslation } from 'react-i18next'
import {
  AppearanceSettingsCard,
  DataManagementCard,
  ProfileSettingsCard,
  HotkeySettingsCard,
  WorkspaceSettingsCard,
  McpSettingsCard,
  StorageSettingsCard,
  IdentitySettingsCard,
  AboutSettingsCard
} from '@baishou/ui'
import { GITHUB_ISSUES_URL, GITHUB_REPO_URL } from '@baishou/shared'
import baishouHeroImg from '../../../assets/images/BaiShou-v0.0.1.jpeg'

export const GeneralSettingsPane: React.FC<{ settings: any }> = ({ settings }) => {
  const { t } = useTranslation()
  const { profile, loadProfile } = useUserProfileStore() as any
  const [vaults, setVaults] = useState<any[]>([])
  const [activeVault, setActiveVault] = useState<any>(null)
  const [appVersion, setAppVersion] = useState('4.0.0')

  const [storageStats, setStorageStats] = useState({
    storageRootPath: 'Loading...',
    sqliteSizeStats: '0 MB',
    vectorDbStats: '0 MB',
    mediaCacheStats: '0 MB'
  })

  useEffect(() => {
    if (loadProfile) loadProfile()
    const fetchVaults = async () => {
      try {
        const vList = await (window as any).api?.vault?.list()
        const active = await (window as any).api?.vault?.getActive()
        if (vList) setVaults(vList)
        if (active) setActiveVault(active)
      } catch (e) {}
    }

    const fetchStorage = async () => {
      try {
        if ((window as any).api?.storage) {
          const stats = await (window as any).api.storage.getStats()
          if (stats) setStorageStats(stats)
        }
      } catch (e) {}
    }

    const fetchVersion = async () => {
      try {
        const v = await (window as any).api?.updater?.getVersion?.()
        if (v) setAppVersion(String(v).replace(/^v+/i, ''))
      } catch {
        /* keep default */
      }
    }

    fetchVaults()
    fetchStorage()
    fetchVersion()
  }, [loadProfile])

  return (
    <div className="settings-pane" style={{ paddingBottom: 0 }}>
      {/* 账户设置 */}
      <div className="glass-panel-card">
        <ProfileSettingsCard
          profile={profile || { nickname: '', autoSync: false, avatarUrl: '' }}
          onSave={async (p) => {
            if (typeof window !== 'undefined' && window.electron) {
              await window.electron.ipcRenderer.invoke('profile:save', p)
              if (loadProfile) await loadProfile()
            }
          }}
        />
      </div>

      {/* 身份卡组 */}
      <div className="glass-panel-card">
        <IdentitySettingsCard
          profile={
            profile || {
              nickname: '',
              avatarPath: '',
              activePersonaId: 'Default',
              personas: { Default: { id: 'Default', facts: {} } }
            }
          }
          onChange={async (newProfile) => {
            if (typeof window !== 'undefined' && window.electron) {
              await window.electron.ipcRenderer.invoke('profile:save', newProfile)
              if (loadProfile) await loadProfile()
            }
          }}
        />
      </div>

      {/* 偏好设置组 */}
      <div className="glass-panel-card">
        <AppearanceSettingsCard
          themeMode={settings.themeMode}
          seedColor={settings.themeColor || '#5BA8F5'}
          language={settings.locale}
          onThemeModeChange={settings.setThemeMode}
          onSeedColorChange={settings.setThemeColor}
          onLanguageChange={settings.setLocale}
        />

        {settings.hotkeyConfig && (
          <>
            <div className="settings-item-divider" />
            <HotkeySettingsCard
              config={settings.hotkeyConfig}
              onChange={(config) => settings.setHotkeyConfig(config)}
            />
          </>
        )}

        <div className="settings-item-divider" />
        <McpSettingsCard
          config={settings.mcpServerConfig || { mcpEnabled: false, mcpPort: 31004 }}
          onChange={settings.setMcpServerConfig}
        />
      </div>

      {/* 系统与数据组 */}
      <div className="glass-panel-card">
        <WorkspaceSettingsCard
          vaults={
            vaults.length > 0 ? vaults : [{ name: t('common.loading', 'Loading...'), path: '--' }]
          }
          activeVault={activeVault || vaults[0] || null}
          onSwitch={async (id) => {
            if (id === activeVault?.name) return
            await (window as any).api?.vault?.switchActive(id)
            window.location.reload()
          }}
          onDelete={async (id) => await (window as any).api?.vault?.delete(id)}
          onCreate={async (name) => {
            await (window as any).api?.vault?.createDialog(name)
            const active = await (window as any).api?.vault?.getActive()
            if (active) setActiveVault(active)
            window.location.reload()
          }}
        />
        <div className="settings-item-divider" />

        <StorageSettingsCard
          storageRootPath={storageStats.storageRootPath}
          sqliteSizeStats={storageStats.sqliteSizeStats}
          vectorDbStats={storageStats.vectorDbStats}
          mediaCacheStats={storageStats.mediaCacheStats}
          onChangeRoot={async () => {
            try {
              const newPath =
                (await (window as any).api?.vault?.pickCustomRootPath?.()) ||
                (await (window as any).api?.system?.pickDirectory?.())
              if (newPath) {
                if ((window as any).api?.storage) {
                  const s = await (window as any).api.storage.getStats()
                  if (s) setStorageStats(s)
                }
              }
            } catch (e) {
              console.error(e)
            }
          }}
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
        <div className="settings-item-divider" />

        <DataManagementCard
          onExportZip={async () => {
            await (window as any).api?.archive?.exportZip()
          }}
          onImportZip={async () => {
            const file = await (window as any).api?.archive?.pickZip()
            if (file) {
              await (window as any).api?.archive?.importZip(file)
            }
          }}
          onPickFile={async () => {
            return await (window as any).api?.archive?.pickZip()
          }}
        />
        <div className="settings-item-divider" />

        <AboutSettingsCard
          version={appVersion}
          heroImageSrc={baishouHeroImg}
          onOpenGithubRepo={() => window.api.shell.openExternal(GITHUB_REPO_URL)}
          onOpenFeedback={() => window.api.shell.openExternal(GITHUB_ISSUES_URL)}
        />
      </div>
    </div>
  )
}
