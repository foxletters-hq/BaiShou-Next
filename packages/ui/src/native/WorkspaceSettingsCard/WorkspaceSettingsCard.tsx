import React, { useMemo } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'
import { settingsHubListStyles as hubStyles } from '../settings/settings-hub.styles'
import { SettingsExpansionTile } from '../settings/SettingsExpansionTile'
import { CardLinkAction } from '../Button'
import { HelpTooltip } from '../Tooltip/HelpTooltip'

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

  const recentVaults = useMemo(() => pickRecentVaults(vaults, activeVault), [vaults, activeVault])

  const currentVault = activeVault

  const workspaceHelpContent = (
    <View style={{ gap: 12 }}>
      <Text style={{ fontSize: 14, color: colors.textPrimary, lineHeight: 20 }}>
        {t(
          'workspace.help_intro',
          '每个工作空间是独立的本地数据区。切换后会刷新页面，并加载该空间内的内容。'
        )}
      </Text>
      <View style={{ gap: 4 }}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textPrimary }}>
          {t('workspace.help_per_vault_title', '切换工作空间后会变：')}
        </Text>
        <Text style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 18 }}>
          • {t('workspace.help_per_vault_diary', '日记与日记附件')}
          {'\n'}• {t('workspace.help_per_vault_summary', '阶段总结与归档')}
          {'\n'}• {t('workspace.help_per_vault_agent', '伙伴配置与聊天记录')}
          {'\n'}• {t('workspace.help_per_vault_attachments', '附件库与回忆画廊')}
        </Text>
      </View>
      <View style={{ gap: 4 }}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textPrimary }}>
          {t('workspace.help_global_title', '切换工作空间后不变：')}
        </Text>
        <Text style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 18 }}>
          • {t('workspace.help_global_ui', '主题、语言等界面设置')}
          {'\n'}• {t('workspace.help_global_ai', 'AI 服务商、模型与 RAG 等配置')}
          {'\n'}• {t('workspace.help_global_profile', '昵称、身份卡与用户头像')}
          {'\n'}• {t('workspace.help_global_registry', '工作空间列表与存储位置')}
        </Text>
      </View>
    </View>
  )

  return (
    <SettingsExpansionTile
      embedded={embedded}
      isLast={isLast}
      title={t('workspace.title', '工作空间')}
      titleAddon={<HelpTooltip content={workspaceHelpContent} />}
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
          <Text style={[hubStyles.rowTitle, { color: colors.textPrimary }]}>
            {currentVault.name}
          </Text>
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
          <View
            style={[
              styles.recentGroup,
              { borderColor: colors.borderStrong, backgroundColor: colors.bgSurfaceNormal }
            ]}
          >
            {recentVaults.map((vault, index) => {
              const isLastRecent = index === recentVaults.length - 1
              return (
                <Pressable
                  key={vault.name}
                  onPress={() => onSwitch(vault.name)}
                  style={({ pressed }) => [
                    styles.recentRow,
                    !isLastRecent && {
                      borderBottomWidth: 1,
                      borderBottomColor: colors.borderStrong
                    },
                    { opacity: pressed ? 0.7 : 1 }
                  ]}
                >
                  <Text
                    style={[hubStyles.rowTitle, { color: colors.textPrimary, flex: 1 }]}
                    numberOfLines={1}
                  >
                    {vault.name}
                  </Text>
                  <Text style={[styles.switchAction, { color: colors.primary }]}>
                    {t('workspace.switch', '切换')}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        </>
      ) : null}

      <CardLinkAction
        variant="card"
        style={styles.manageLink}
        onPress={() => onManageWorkspace?.()}
        isDisabled={!onManageWorkspace}
      >
        {t('workspace.manage', '管理工作区')}
      </CardLinkAction>
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
  recentGroup: {
    borderWidth: 1,
    borderRadius: 10,
    overflow: 'hidden'
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 11
  },
  switchAction: {
    fontSize: 14,
    fontWeight: '600'
  },
  manageLink: {
    marginTop: 12
  }
})
