import React, { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { MdWorkspacesOutline, MdFolderSpecial, MdAdd, MdCheckCircle } from 'react-icons/md'
import { useDialog } from '../Dialog'
import { useToast } from '../Toast/useToast'
import '../shared/SettingsListTile.css'
import { SettingsExpansionTile } from '../shared/SettingsExpansionTile'
import { WorkspaceScopeHelpTooltip } from './WorkspaceScopeHelpTooltip'
import { pickRecentVaults } from './workspace-settings.utils'
import { validateWorkspaceName } from './workspace-name.validation'
import styles from './WorkspaceSettingsCard.module.css'

export { WorkspaceScopeHelpTooltip } from './WorkspaceScopeHelpTooltip'
export type { WorkspaceScopeHelpTooltipProps } from './WorkspaceScopeHelpTooltip'
export { validateWorkspaceName }
export type {
  WorkspaceNameValidationReason,
  WorkspaceNameValidationResult
} from './workspace-name.validation'

export interface VaultInfo {
  name: string
  path: string
  createdAt: Date | string
  lastAccessedAt: Date | string
}

export interface WorkspaceSettingsCardProps {
  vaults: VaultInfo[]
  activeVault: VaultInfo | null
  onSwitch: (name: string) => void
  onDelete: (name: string) => void
  onCreate: (name: string) => Promise<void>
  customRootPath?: string | null
  onPickCustomRoot?: () => Promise<string | null>
  embedded?: boolean
  isLast?: boolean
  onManageWorkspace?: () => void
}

export const WorkspaceSettingsCard: React.FC<WorkspaceSettingsCardProps> = ({
  vaults,
  activeVault,
  onSwitch,
  onDelete,
  onCreate,
  embedded = false,
  isLast = false,
  onManageWorkspace
}) => {
  const { t } = useTranslation()
  const dialog = useDialog()
  const toast = useToast()

  const recentVaults = useMemo(() => pickRecentVaults(vaults, activeVault), [vaults, activeVault])

  const handleCreate = async () => {
    const name = await dialog.prompt(t('workspace.new_name', '空间名称'), '')
    if (name === null) return
    const validation = validateWorkspaceName(
      name,
      vaults.map((vault) => vault.name)
    )
    if (!validation.ok) {
      const message =
        validation.reason === 'duplicate'
          ? t('workspace.name_exists', '已经有同名工作空间啦，换一个名字试试。')
          : t('workspace.name_invalid', '工作空间名称不能包含特殊字符，且不能以点号结尾。')
      toast.showWarning(message)
      return
    }
    try {
      await onCreate(validation.name)
    } catch (e: unknown) {
      const err = e as Error & { code?: string; vaultName?: string; reason?: string }
      if (err?.code === 'VAULT_NAME_EXISTS') {
        toast.showError(
          t('workspace.name_exists', {
            name: err.vaultName ?? validation.name,
            defaultValue: '工作空间「{{name}}」已存在，请使用其他名称'
          })
        )
        return
      }
      if (err?.code === 'VAULT_INVALID_NAME') {
        toast.showError(
          t(
            err.reason === 'empty' ? 'workspace.name_empty' : 'workspace.invalid_name',
            {
              defaultValue:
                err.reason === 'empty'
                  ? '请输入工作空间名称'
                  : '名称不能包含 / \\ : % # ? * 等特殊字符'
            }
          )
        )
        return
      }
      toast.showError(t('workspace.create_failed', '创建失败'))
    }
  }

  const handleDelete = async (vaultName: string) => {
    const input = await dialog.prompt(
      t('workspace.delete_confirm_input', '请输入工作区名称 "{{name}}" 以确认删除：', {
        name: vaultName
      })
    )
    if (input === vaultName) {
      onDelete(vaultName)
    } else if (input !== null) {
      toast.showError(t('workspace.delete_name_mismatch', '名称不匹配，删除已取消。'))
    }
  }

  const lastAccessed = (v: VaultInfo) => {
    if (!v.lastAccessedAt) return t('common.unknown_time', '未知时间')
    try {
      const d = typeof v.lastAccessedAt === 'string' ? new Date(v.lastAccessedAt) : v.lastAccessedAt
      return d.toLocaleString().split('.')[0].replace('T', ' ')
    } catch {
      return t('common.unknown_time', '未知时间')
    }
  }

  const embeddedBody = (
    <>
      <div className={styles.workspaceCurrentBlock}>
        <div className={styles.workspaceCurrentInfo}>
          {activeVault ? (
            <>
              <span className={styles.workspaceSectionLabel}>
                {t('workspace.current_space', '当前空间')}
              </span>
              <span className="settings-list-tile-title">{activeVault.name}</span>
              {activeVault.path ? (
                <span className={styles.workspacePathText}>
                  {activeVault.path.replace(/^file:\/\//, '')}
                </span>
              ) : null}
            </>
          ) : (
            <span className={styles.workspaceEmptyHint}>
              {t('workspace.no_active', '尚未选择工作空间')}
            </span>
          )}
        </div>
        <button
          type="button"
          className={styles.workspaceManageButton}
          onClick={() => onManageWorkspace?.()}
          disabled={!onManageWorkspace}
        >
          {t('workspace.manage', '管理工作空间')}
        </button>
      </div>

      {recentVaults.length > 0 ? (
        <>
          <span className={styles.workspaceSectionLabel} style={{ marginBottom: 4, marginTop: 4 }}>
            {t('workspace.recent_hint', '仅显示最近使用的三个工作空间')}
          </span>
          <div className={styles.workspaceRecentList}>
            {recentVaults.map((vault) => (
              <button
                key={vault.name}
                type="button"
                className={styles.workspaceRecentCard}
                onMouseEnter={() => {
                  if (typeof window !== 'undefined' && (window as any).api?.vault?.preload) {
                    void (window as any).api.vault.preload(vault.name)
                  }
                }}
                onClick={() => onSwitch(vault.name)}
              >
                <span className={styles.workspaceRecentTitle}>{vault.name}</span>
                <span className={styles.workspaceRecentAction}>
                  {t('workspace.switch', '切换')}
                </span>
              </button>
            ))}
          </div>
        </>
      ) : null}
    </>
  )

  if (embedded) {
    return (
      <SettingsExpansionTile
        embedded
        isLast={isLast}
        title={t('workspace.title', '工作空间')}
        titleAddon={<WorkspaceScopeHelpTooltip />}
        subtitle={t('workspace.current', '当前空间: {{name}}', {
          name: activeVault?.name ?? t('common.unknown', '未知')
        })}
      >
        {embeddedBody}
      </SettingsExpansionTile>
    )
  }

  return (
    <SettingsExpansionTile
      icon={<MdWorkspacesOutline size={24} />}
      title={t('workspace.title', '工作空间')}
      titleAddon={<WorkspaceScopeHelpTooltip />}
      subtitle={t('workspace.current', '当前空间: {{name}}', {
        name: activeVault?.name ?? '未知'
      })}
    >
      {vaults.map((vault) => {
        const isActive = activeVault?.name === vault.name
        return (
          <div key={vault.name} className="settings-list-tile settings-list-tile-noclick">
            <div className="settings-list-tile-leading">
              <MdFolderSpecial size={22} />
            </div>
            <div className="settings-list-tile-content">
              <span className="settings-list-tile-title">{vault.name}</span>
              <span className="settings-list-tile-subtitle">
                {t('workspace.last_accessed', '上次访问: {{time}}', {
                  time: lastAccessed(vault)
                })}
              </span>
            </div>
            {isActive ? (
              <MdCheckCircle
                size={22}
                style={{
                  color: 'var(--color-primary, #5BA8F5)',
                  flexShrink: 0
                }}
              />
            ) : (
              <div style={{ display: 'flex', gap: 4 }}>
                <button
                  className="settings-text-btn"
                  onMouseEnter={() => {
                    if (typeof window !== 'undefined' && (window as any).api?.vault?.preload) {
                      void (window as any).api.vault.preload(vault.name)
                    }
                  }}
                  onClick={() => onSwitch(vault.name)}
                >
                  {t('workspace.switch', '切换')}
                </button>
                <button
                  className="settings-text-btn"
                  style={{ color: '#ef4444' }}
                  onClick={() => handleDelete(vault.name)}
                >
                  {t('workspace.delete', '删除')}
                </button>
              </div>
            )}
          </div>
        )
      })}

      <div className="settings-list-divider indent" />

      <button className="settings-list-tile" onClick={handleCreate}>
        <div className="settings-list-tile-leading">
          <MdAdd size={22} />
        </div>
        <div className="settings-list-tile-content">
          <span className="settings-list-tile-title">
            {t('workspace.create_new', '创建新空间')}
          </span>
        </div>
      </button>
    </SettingsExpansionTile>
  )
}
