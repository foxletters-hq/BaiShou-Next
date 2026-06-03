import React, { useMemo } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'
import { settingsHubListStyles as hubStyles } from '../settings/settings-hub.styles'
import { SettingsExpansionTile } from '../settings/SettingsExpansionTile'

export interface VaultInfo {
  name: string
  path: string
  createdAt: Date | string
  lastAccessedAt: Date | string
}

export interface NativeWorkspaceSettingsCardProps {
  vaults: VaultInfo[]
  activeVault: VaultInfo | null
  onSwitch: (name: string) => void
  onDelete: (name: string) => void
  onCreate: (name: string) => Promise<void>
  onManageWorkspace?: () => void
  customRootPath?: string | null
  onPickCustomRoot?: () => Promise<string | null>
  embedded?: boolean
  isLast?: boolean
}

const RECENT_LIMIT = 3

function toTimestamp(value: Date | string | undefined): number {
  if (!value) return 0
  try {
    return (typeof value === 'string' ? new Date(value) : value).getTime()
  } catch {
    return 0
  }
}

function pickRecentVaults(vaults: VaultInfo[], activeVault: VaultInfo | null): VaultInfo[] {
  const sorted = [...vaults].sort(
    (a, b) => toTimestamp(b.lastAccessedAt) - toTimestamp(a.lastAccessedAt)
  )
  const picked: VaultInfo[] = []
  for (const vault of sorted) {
    if (activeVault && vault.name === activeVault.name) continue
    if (picked.length >= RECENT_LIMIT) break
    picked.push(vault)
  }
  return picked
}

export const WorkspaceSettingsCard: React.FC<NativeWorkspaceSettingsCardProps> = ({
  vaults,
  activeVault,
  onSwitch,
  onManageWorkspace,
  embedded = false,
  isLast = false
}) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()

  const recentVaults = useMemo(
    () => pickRecentVaults(vaults, activeVault),
    [vaults, activeVault]
  )

  const currentVault = activeVault

  return (
    <SettingsExpansionTile
      embedded={embedded}
      isLast={isLast}
      title={t('workspace.title', '工作空间')}
      subtitle={t('workspace.current', '当前空间: {{name}}', {
        name: activeVault?.name ?? t('common.unknown', '未知')
      })}
    >
      {currentVault ? (
        <View
          style={[
            styles.currentBlock,
            { borderColor: colors.borderSubtle, backgroundColor: colors.bgSurfaceNormal }
          ]}
        >
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
            {t('workspace.current_space', '当前空间')}
          </Text>
          <Text style={[hubStyles.rowTitle, { color: colors.textPrimary }]}>{currentVault.name}</Text>
          {currentVault.path ? (
            <Text style={[styles.pathText, { color: colors.textSecondary }]} numberOfLines={2}>
              {currentVault.path.replace(/^file:\/\//, '')}
            </Text>
          ) : null}
        </View>
      ) : (
        <Text style={[styles.emptyHint, { color: colors.textSecondary }]}>
          {t('workspace.no_active', '尚未选择工作空间')}
        </Text>
      )}

      {recentVaults.length > 0 ? (
        <>
          <Text style={[styles.sectionLabel, styles.recentLabel, { color: colors.textSecondary }]}>
            {t('workspace.recent_hint', '仅显示最近使用的三个工作空间')}
          </Text>
          {recentVaults.map((vault, index) => {
            const isLastRecent = index === recentVaults.length - 1
            return (
              <Pressable
                key={vault.name}
                onPress={() => onSwitch(vault.name)}
                style={({ pressed }) => [
                  styles.recentRow,
                  !isLastRecent && {
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: colors.borderSubtle
                  },
                  { opacity: pressed ? 0.7 : 1 }
                ]}
              >
                <Text style={[hubStyles.rowTitle, { color: colors.textPrimary, flex: 1 }]} numberOfLines={1}>
                  {vault.name}
                </Text>
                <Text style={[styles.actionText, { color: colors.primary }]}>
                  {t('workspace.switch', '切换')}
                </Text>
              </Pressable>
            )
          })}
        </>
      ) : null}

      <Pressable
        onPress={onManageWorkspace}
        disabled={!onManageWorkspace}
        style={({ pressed }) => [
          styles.manageRow,
          {
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: colors.borderSubtle,
            opacity: !onManageWorkspace ? 0.45 : pressed ? 0.7 : 1
          }
        ]}
      >
        <Text style={[hubStyles.rowTitle, { color: colors.primary }]}>
          {t('workspace.manage', '管理工作区')}
        </Text>
        <Text style={[styles.chevron, { color: colors.textTertiary }]}>›</Text>
      </Pressable>
    </SettingsExpansionTile>
  )
}

const styles = StyleSheet.create({
  currentBlock: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    padding: 12,
    gap: 4,
    marginBottom: 8
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2
  },
  recentLabel: {
    marginBottom: 4,
    marginTop: 4
  },
  pathText: {
    fontSize: 12,
    fontFamily: 'monospace',
    lineHeight: 16
  },
  emptyHint: {
    fontSize: 13,
    marginBottom: 8
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 10
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600'
  },
  manageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    marginTop: 4
  },
  chevron: {
    fontSize: 18
  }
})
