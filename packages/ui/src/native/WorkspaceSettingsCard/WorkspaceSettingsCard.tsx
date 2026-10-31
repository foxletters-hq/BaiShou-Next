import React, { useMemo } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Layers } from 'lucide-react-native'
import { useNativeTheme } from '../theme'
import { settingsHubListStyles as hubStyles } from '../settings/settings-hub.styles'
import { SettingsExpansionTile } from '../settings/SettingsExpansionTile'
import { CardLinkAction } from '../Button'
import { HelpTooltip } from '../Tooltip/HelpTooltip'
import { DEFAULT_STROKE_WIDTH, NAV_ICON_SIZE } from '../../shared/icons/icon-sizes'
import { mobileTypography, sharedTokens } from '../../theme/tokens'

export interface VaultInfo {
  /** 稳定身份；旧调用方可能未传 */
  id?: string
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

  const perVaultItems = [
    t('workspace.help_per_vault_agent', '伙伴人设、记忆、关系图谱与聊天记录'),
    t('workspace.help_per_vault_diary', '日记与日记附件'),
    t('workspace.help_per_vault_summary', '阶段总结与归档'),
    t('workspace.help_per_vault_attachments', '附件库与回忆画廊')
  ]

  const globalItems = [
    t('workspace.help_global_ui', '主题、语言等界面设置'),
    t('workspace.help_global_ai', 'AI 服务商、模型与 RAG 等配置'),
    t('workspace.help_global_profile', '昵称、身份卡与用户头像'),
    t('workspace.help_global_registry', '小窝列表与存储位置')
  ]

  const workspaceHelpContent = (
    <View style={{ gap: sharedTokens.spacing.mdTight }}>
      <Text
        style={{
          fontSize: mobileTypography.secondary.fontSize,
          color: colors.textPrimary,
          lineHeight: 20
        }}
      >
        {t(
          'workspace.help_intro',
          '小窝是你与伙伴共同生活的独立空间。如果你有多个伙伴，可以创建并切换不同的小窝——切换小窝后，对应的伙伴、日记、记忆与全部专属数据都会一并切换。'
        )}
      </Text>
      <View style={{ gap: sharedTokens.spacing.xsPlus }}>
        <Text
          style={{
            fontSize: mobileTypography.secondary.fontSize,
            fontWeight: '600',
            color: colors.textPrimary
          }}
        >
          {t('workspace.help_per_vault_title', '切换小窝后会随之切换：')}
        </Text>
        <View
          style={{
            gap: sharedTokens.spacing.xsPlus,
            paddingLeft: sharedTokens.spacing.xxs
          }}
        >
          {perVaultItems.map((item) => (
            <View
              key={item}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: sharedTokens.spacing.sm
              }}
            >
              <View
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: 2.5,
                  backgroundColor: colors.primary
                }}
              />
              <Text
                style={{
                  fontSize: mobileTypography.secondary.fontSize,
                  color: colors.textSecondary,
                  lineHeight: 18,
                  flex: 1
                }}
              >
                {item}
              </Text>
            </View>
          ))}
        </View>
      </View>
      <View style={{ gap: sharedTokens.spacing.xsPlus }}>
        <Text
          style={{
            fontSize: mobileTypography.secondary.fontSize,
            fontWeight: '600',
            color: colors.textPrimary
          }}
        >
          {t('workspace.help_global_title', '切换小窝后不变：')}
        </Text>
        <View
          style={{
            gap: sharedTokens.spacing.xsPlus,
            paddingLeft: sharedTokens.spacing.xxs
          }}
        >
          {globalItems.map((item) => (
            <View
              key={item}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: sharedTokens.spacing.sm
              }}
            >
              <View
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: 2.5,
                  backgroundColor: colors.textTertiary
                }}
              />
              <Text
                style={{
                  fontSize: mobileTypography.secondary.fontSize,
                  color: colors.textSecondary,
                  lineHeight: 18,
                  flex: 1
                }}
              >
                {item}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  )

  return (
    <SettingsExpansionTile
      embedded={embedded}
      isLast={isLast}
      icon={
        <Layers
          size={NAV_ICON_SIZE}
          strokeWidth={DEFAULT_STROKE_WIDTH}
          color={colors.textSecondary}
        />
      }
      title={t('workspace.title', '小窝')}
      titleAddon={<HelpTooltip content={workspaceHelpContent} />}
      subtitle={t('workspace.current', '当前小窝: {{name}}', {
        name: activeVault?.name ?? t('common.unknown', '未知')
      })}
    >
      {currentVault ? (
        <View
          style={[
            styles.currentBlock,
            { borderColor: colors.borderMuted, backgroundColor: colors.bgSurface }
          ]}
        >
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
            {t('workspace.current_space', '当前小窝')}
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
          {t('workspace.no_active', '尚未选择小窝')}
        </Text>
      )}

      {recentVaults.length > 0 ? (
        <>
          <Text style={[styles.sectionLabel, styles.recentLabel, { color: colors.textSecondary }]}>
            {t('workspace.recent_hint', '仅显示最近使用的三个小窝')}
          </Text>
          <View style={styles.recentList}>
            {recentVaults.map((vault) => (
              <Pressable
                key={vault.name}
                onPress={() => onSwitch(vault.name)}
                style={({ pressed }) => [
                  styles.recentCard,
                  {
                    borderColor: colors.borderMuted,
                    backgroundColor: colors.bgSurface,
                    opacity: pressed ? 0.92 : 1
                  }
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
            ))}
          </View>
        </>
      ) : null}

      <CardLinkAction
        variant="card"
        style={styles.manageLink}
        onPress={() => onManageWorkspace?.()}
        isDisabled={!onManageWorkspace}
      >
        {t('workspace.manage', '管理小窝')}
      </CardLinkAction>
    </SettingsExpansionTile>
  )
}

const styles = StyleSheet.create({
  currentBlock: {
    borderWidth: 1,
    borderStyle: 'solid',
    borderRadius: sharedTokens.radius.lg,
    padding: sharedTokens.spacing.mdTight,
    gap: sharedTokens.spacing.xs,
    marginBottom: sharedTokens.spacing.sm
  },
  sectionLabel: {
    fontSize: mobileTypography.caption.fontSize,
    fontWeight: '600',
    letterSpacing: 0.2
  },
  recentLabel: {
    marginBottom: sharedTokens.spacing.xs,
    marginTop: sharedTokens.spacing.xs
  },
  pathText: {
    fontSize: mobileTypography.caption.fontSize,
    fontFamily: 'monospace',
    lineHeight: 16
  },
  emptyHint: {
    fontSize: mobileTypography.secondary.fontSize,
    marginBottom: sharedTokens.spacing.sm
  },
  recentList: {
    gap: sharedTokens.spacing.mdTight
  },
  recentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: sharedTokens.spacing.mdTight,
    paddingHorizontal: sharedTokens.spacing.mdSnug,
    paddingVertical: sharedTokens.spacing.mdTight,
    borderRadius: sharedTokens.radius.lg,
    borderWidth: 1,
    borderStyle: 'solid'
  },
  switchAction: {
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: '600'
  },
  manageLink: {
    marginTop: sharedTokens.spacing.mdTight,
    alignSelf: 'stretch',
    justifyContent: 'center'
  }
})
