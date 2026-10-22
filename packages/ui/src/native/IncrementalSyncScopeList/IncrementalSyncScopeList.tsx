import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  type StyleProp,
  type ViewStyle
} from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming
} from 'react-native-reanimated'
import { useTranslation } from 'react-i18next'
import {
  Bookmark,
  Bot,
  CircleAlert,
  CircleCheck,
  ChevronDown,
  FileText,
  FolderArchive,
  Info,
  MessageSquare,
  Paperclip,
  RefreshCw,
  SlidersHorizontal,
  Sparkles
} from 'lucide-react-native'
import { INCREMENTAL_SYNC_SCOPE_I18N_KEYS } from '@baishou/shared'
import { useNativeTheme } from '../theme'
import { SyncModeComparisonHelp } from '../SyncModeComparisonNotice'
import { CollapsibleHeight } from '../CollapsibleHeight'
import { mobileTypography, sharedTokens, uiTypography } from '../../theme/tokens'

export interface IncrementalSyncScopeListProps {
  /** 默认是否展开完整范围说明，默认为 true */
  defaultExpanded?: boolean
  /** 是否支持折叠与展开，默认为 true */
  collapsible?: boolean
  /** 是否隐藏标题行，默认为 false */
  hideTitle?: boolean
  /** 外层容器自定义样式 */
  style?: StyleProp<ViewStyle>
}

const KNOWN_SCOPE_KEYS = new Set([
  'incremental_sync_scope_all_vaults',
  'incremental_sync_scope_diary',
  'incremental_sync_scope_summary',
  'incremental_sync_scope_sessions',
  'incremental_sync_scope_partners',
  'incremental_sync_scope_attachments',
  'incremental_sync_scope_settings',
  'incremental_sync_scope_registry'
])

export const IncrementalSyncScopeList: React.FC<IncrementalSyncScopeListProps> = ({
  defaultExpanded = true,
  collapsible = true,
  hideTitle = false,
  style
}) => {
  const { t } = useTranslation()
  const { colors, tokens } = useNativeTheme()
  const [expanded, setExpanded] = useState(defaultExpanded)
  const chevronProgress = useSharedValue(defaultExpanded ? 1 : 0)

  useEffect(() => {
    chevronProgress.value = withTiming(expanded ? 1 : 0, {
      duration: 250,
      easing: Easing.bezier(0.4, 0, 0.2, 1)
    })
  }, [expanded, chevronProgress])

  const chevronAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${chevronProgress.value * 180}deg` }]
  }))

  const handleToggle = () => {
    if (!collapsible) return
    setExpanded((prev) => !prev)
  }

  // 兜底未识别的未来新增键
  const fallbackExtraKeys = INCREMENTAL_SYNC_SCOPE_I18N_KEYS.filter(
    (key) => !KNOWN_SCOPE_KEYS.has(key)
  )

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.bgSurface,
          borderColor: colors.borderSubtle,
          borderRadius: tokens.radius.lg
        },
        style
      ]}
    >
      {/* 头部摘要行 */}
      {!hideTitle && (
        <View style={styles.headerRow}>
          <TouchableOpacity
            activeOpacity={0.7}
            disabled={!collapsible}
            onPress={handleToggle}
            style={styles.headerTitlePressable}
            accessibilityRole="button"
            accessibilityState={{ expanded }}
            accessibilityLabel={t('data_sync.incremental_sync_scope_title')}
          >
            <View
              style={[styles.headerIconContainer, { backgroundColor: colors.primaryContainer }]}
            >
              <RefreshCw size={16} color={colors.primary} strokeWidth={2} />
            </View>

            <View style={styles.headerTitleGroup}>
              <View style={styles.headerTitleRow}>
                <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
                  {t('data_sync.incremental_sync_scope_title')}
                </Text>
                <View style={[styles.tagBadge, { backgroundColor: colors.bgSurfaceNormal }]}>
                  <Text style={[styles.tagBadgeText, { color: colors.textSecondary }]}>
                    {t('data_sync.incremental_sync_tag', '双向增量')}
                  </Text>
                </View>
              </View>
              {!expanded && (
                <Text
                  numberOfLines={1}
                  style={[styles.headerSummary, { color: colors.textTertiary }]}
                >
                  {t('data_sync.sync_mode_comparison_incremental_desc')}
                </Text>
              )}
            </View>
          </TouchableOpacity>

          <View style={styles.headerActions}>
            <SyncModeComparisonHelp context="incremental" size={16} />
            {collapsible && (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={handleToggle}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={styles.chevronButton}
                accessibilityRole="button"
                accessibilityLabel={
                  expanded ? t('common.collapse', '收起') : t('common.expand', '展开')
                }
              >
                <Animated.View style={chevronAnimatedStyle}>
                  <ChevronDown size={18} color={colors.textTertiary} strokeWidth={2} />
                </Animated.View>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* 展开的详情结构区块 */}
      <CollapsibleHeight expanded={expanded} animation="ease" durationMs={250}>
        <View style={[styles.body, !hideTitle && { borderTopColor: colors.borderSubtle }]}>
          {/* 1. 机制概述条 */}
          <View
            style={[
              styles.introCallout,
              {
                backgroundColor: colors.primaryContainer,
                borderLeftColor: colors.primary
              }
            ]}
          >
            <Info size={15} color={colors.primary} strokeWidth={2} style={styles.introIcon} />
            <Text style={[styles.introText, { color: colors.textPrimary }]}>
              {t('data_sync.sync_mode_comparison_incremental_desc')}
            </Text>
          </View>

          {/* 2. 分组：工作区与写作内容 */}
          <View style={styles.sectionBlock}>
            <View style={styles.sectionHeader}>
              <CircleCheck size={15} color={colors.success} strokeWidth={2.2} />
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                {t('data_sync.incremental_group_content', '工作区与写作内容')}
              </Text>
            </View>

            <View style={styles.itemsList}>
              {/* 全部工作区 */}
              <View style={styles.itemRow}>
                <View style={[styles.itemIconBadge, { backgroundColor: colors.primaryContainer }]}>
                  <FolderArchive size={15} color={colors.primary} strokeWidth={2} />
                </View>
                <View style={styles.itemContentCol}>
                  <Text style={[styles.itemPrimaryText, { color: colors.textPrimary }]}>
                    {t('data_sync.incremental_sync_scope_all_vaults')}
                  </Text>
                </View>
              </View>

              {/* 日记与元数据 */}
              <View style={styles.itemRow}>
                <View style={[styles.itemIconBadge, { backgroundColor: colors.primaryContainer }]}>
                  <FileText size={15} color={colors.primary} strokeWidth={2} />
                </View>
                <View style={styles.itemContentCol}>
                  <Text style={[styles.itemPrimaryText, { color: colors.textPrimary }]}>
                    {t('data_sync.incremental_sync_scope_diary')}
                  </Text>
                </View>
              </View>

              {/* AI 总结与记忆碎片 */}
              <View style={styles.itemRow}>
                <View style={[styles.itemIconBadge, { backgroundColor: colors.primaryContainer }]}>
                  <Sparkles size={15} color={colors.primary} strokeWidth={2} />
                </View>
                <View style={styles.itemContentCol}>
                  <Text style={[styles.itemPrimaryText, { color: colors.textPrimary }]}>
                    {t('data_sync.incremental_sync_scope_summary')}
                  </Text>
                </View>
              </View>

              {/* 附件与头像 */}
              <View style={styles.itemRow}>
                <View style={[styles.itemIconBadge, { backgroundColor: colors.primaryContainer }]}>
                  <Paperclip size={15} color={colors.primary} strokeWidth={2} />
                </View>
                <View style={styles.itemContentCol}>
                  <Text style={[styles.itemPrimaryText, { color: colors.textPrimary }]}>
                    {t('data_sync.incremental_sync_scope_attachments')}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          <View style={[styles.sectionDivider, { backgroundColor: colors.borderSubtle }]} />

          {/* 3. 分组：智能体与伙伴 */}
          <View style={styles.sectionBlock}>
            <View style={styles.sectionHeader}>
              <Bot size={15} color={colors.primary} strokeWidth={2} />
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                {t('data_sync.incremental_group_agent', '智能体与伙伴')}
              </Text>
            </View>

            <View style={styles.itemsList}>
              {/* 会话历史 */}
              <View style={styles.itemRow}>
                <View style={[styles.itemIconBadge, { backgroundColor: colors.primaryContainer }]}>
                  <MessageSquare size={15} color={colors.primary} strokeWidth={2} />
                </View>
                <View style={styles.itemContentCol}>
                  <Text style={[styles.itemPrimaryText, { color: colors.textPrimary }]}>
                    {t('data_sync.incremental_sync_scope_sessions')}
                  </Text>
                </View>
              </View>

              {/* AI 伙伴配置 */}
              <View style={styles.itemRow}>
                <View style={[styles.itemIconBadge, { backgroundColor: colors.primaryContainer }]}>
                  <Bot size={15} color={colors.primary} strokeWidth={2} />
                </View>
                <View style={styles.itemContentCol}>
                  <Text style={[styles.itemPrimaryText, { color: colors.textPrimary }]}>
                    {t('data_sync.incremental_sync_scope_partners')}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          <View style={[styles.sectionDivider, { backgroundColor: colors.borderSubtle }]} />

          {/* 4. 分组：配置与注册表 */}
          <View style={styles.sectionBlock}>
            <View style={styles.sectionHeader}>
              <SlidersHorizontal size={15} color={colors.textSecondary} strokeWidth={2} />
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                {t('data_sync.incremental_group_config', '配置与空间注册表')}
              </Text>
            </View>

            <View style={styles.itemsList}>
              {/* 各工作区设置 */}
              <View style={styles.itemRow}>
                <View style={[styles.itemIconBadge, { backgroundColor: colors.primaryContainer }]}>
                  <SlidersHorizontal size={15} color={colors.primary} strokeWidth={2} />
                </View>
                <View style={styles.itemContentCol}>
                  <Text style={[styles.itemPrimaryText, { color: colors.textPrimary }]}>
                    {t('data_sync.incremental_sync_scope_settings')}
                  </Text>
                </View>
              </View>

              {/* 工作区注册表 */}
              <View style={styles.itemRow}>
                <View style={[styles.itemIconBadge, { backgroundColor: colors.primaryContainer }]}>
                  <Bookmark size={15} color={colors.primary} strokeWidth={2} />
                </View>
                <View style={styles.itemContentCol}>
                  <Text style={[styles.itemPrimaryText, { color: colors.textPrimary }]}>
                    {t('data_sync.incremental_sync_scope_registry')}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* 5. 机制提示 */}
          <View
            style={[
              styles.noticeBox,
              {
                backgroundColor: colors.primaryContainer,
                borderLeftColor: colors.primary
              }
            ]}
          >
            <View style={styles.noticeHeader}>
              <CircleAlert size={14} color={colors.primary} strokeWidth={2} />
              <Text style={[styles.noticeTitle, { color: colors.primary }]}>
                {t('data_sync.incremental_sync_notice_title', '增量同步机制')}
              </Text>
            </View>
            <Text style={[styles.noticeText, { color: colors.textSecondary }]}>
              {t(
                'data_sync.incremental_sync_scope_notice',
                '文件粒度双向增量传输：仅传输产生变动的文件，未修改的文件不产生流量；支持离线编写后自动合流。'
              )}
            </Text>
          </View>

          {/* 兜底额外键（若将来扩展） */}
          {fallbackExtraKeys.length > 0 && (
            <View style={styles.itemsList}>
              {fallbackExtraKeys.map((key) => (
                <View key={key} style={styles.itemRow}>
                  <Text style={[styles.itemPrimaryText, { color: colors.textSecondary }]}>
                    • {t(`data_sync.${key}`)}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </CollapsibleHeight>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    overflow: 'hidden'
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: sharedTokens.spacing.md,
    paddingVertical: sharedTokens.spacing.mdTight
  },
  headerTitlePressable: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: sharedTokens.spacing.smPlus,
    marginRight: sharedTokens.spacing.sm
  },
  headerIconContainer: {
    width: 32,
    height: 32,
    borderRadius: sharedTokens.radius.sm,
    alignItems: 'center',
    justifyContent: 'center'
  },
  headerTitleGroup: {
    flex: 1,
    justifyContent: 'center',
    gap: sharedTokens.spacing.xxs
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sharedTokens.spacing.xsPlus,
    flexWrap: 'wrap'
  },
  headerTitle: {
    fontSize: mobileTypography.primary.fontSize,
    fontWeight: '600',
    lineHeight: 20
  },
  tagBadge: {
    paddingHorizontal: sharedTokens.spacing.xsPlus,
    paddingVertical: 2,
    borderRadius: sharedTokens.radius.xs
  },
  tagBadgeText: {
    fontSize: mobileTypography.caption.fontSize,
    fontWeight: '500'
  },
  headerSummary: {
    fontSize: mobileTypography.caption.fontSize,
    lineHeight: 16
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sharedTokens.spacing.xsPlus
  },
  chevronButton: {
    padding: sharedTokens.spacing.xxs
  },
  body: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: sharedTokens.spacing.md,
    paddingTop: sharedTokens.spacing.mdTight,
    paddingBottom: sharedTokens.spacing.md,
    gap: sharedTokens.spacing.md
  },
  introCallout: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: sharedTokens.spacing.sm,
    paddingHorizontal: sharedTokens.spacing.mdTight,
    paddingVertical: sharedTokens.spacing.sm,
    borderRadius: sharedTokens.radius.md,
    borderLeftWidth: 3
  },
  introIcon: {
    marginTop: 2
  },
  introText: {
    flex: 1,
    fontSize: uiTypography.sm,
    lineHeight: 18
  },
  sectionBlock: {
    gap: sharedTokens.spacing.smPlus
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sharedTokens.spacing.xsPlus
  },
  sectionTitle: {
    fontSize: uiTypography.md,
    fontWeight: '600'
  },
  sectionDivider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 2
  },
  itemsList: {
    gap: sharedTokens.spacing.sm
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sharedTokens.spacing.smPlus,
    paddingVertical: 2
  },
  itemIconBadge: {
    width: 28,
    height: 28,
    borderRadius: sharedTokens.radius.sm,
    alignItems: 'center',
    justifyContent: 'center'
  },
  itemContentCol: {
    flex: 1
  },
  itemPrimaryText: {
    fontSize: uiTypography.md,
    lineHeight: 19
  },
  noticeBox: {
    paddingHorizontal: sharedTokens.spacing.mdTight,
    paddingVertical: sharedTokens.spacing.smPlus,
    borderRadius: sharedTokens.radius.md,
    borderLeftWidth: 3,
    gap: sharedTokens.spacing.xsPlus
  },
  noticeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sharedTokens.spacing.xsPlus,
    marginBottom: 2
  },
  noticeTitle: {
    fontSize: uiTypography.sm,
    fontWeight: '600'
  },
  noticeText: {
    fontSize: uiTypography.sm,
    lineHeight: 17
  }
})
