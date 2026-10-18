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
  Archive,
  CircleAlert,
  CircleCheck,
  CircleMinus,
  ChevronDown,
  Database,
  FolderArchive,
  Info,
  SlidersHorizontal
} from 'lucide-react-native'
import { FULL_BACKUP_SCOPE_I18N_KEYS } from '@baishou/shared'
import { useNativeTheme } from '../theme'
import { SyncModeComparisonHelp } from '../SyncModeComparisonNotice'
import { CollapsibleHeight } from '../CollapsibleHeight'
import { mobileTypography, sharedTokens } from '../../theme/tokens'

export interface BackupScopeListProps {
  /** 默认是否展开完整范围说明，默认为 true */
  defaultExpanded?: boolean
  /** 是否支持折叠与展开，默认为 true */
  collapsible?: boolean
  /** 外层容器自定义样式 */
  style?: StyleProp<ViewStyle>
}

const KNOWN_SCOPE_KEYS = new Set([
  'backup_scope_intro',
  'backup_scope_root',
  'backup_scope_database',
  'backup_scope_database_detail',
  'backup_scope_device_prefs',
  'backup_scope_not_incremental',
  'backup_scope_excludes_heading',
  'backup_scope_excludes_shadow',
  'backup_scope_excludes_sync_meta',
  'backup_scope_import_note'
])

export const BackupScopeList: React.FC<BackupScopeListProps> = ({
  defaultExpanded = true,
  collapsible = true,
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

  // 兜底未来可能新增且未分配归属的键
  const fallbackExtraKeys = FULL_BACKUP_SCOPE_I18N_KEYS.filter((key) => !KNOWN_SCOPE_KEYS.has(key))

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
      <View style={styles.headerRow}>
        <TouchableOpacity
          activeOpacity={0.7}
          disabled={!collapsible}
          onPress={handleToggle}
          style={styles.headerTitlePressable}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          accessibilityLabel={t('data_sync.backup_scope_title')}
        >
          <View style={[styles.headerIconContainer, { backgroundColor: colors.primaryContainer }]}>
            <Archive size={16} color={colors.primary} strokeWidth={2} />
          </View>

          <View style={styles.headerTitleGroup}>
            <View style={styles.headerTitleRow}>
              <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
                {t('data_sync.backup_scope_title')}
              </Text>
              <View style={[styles.zipBadge, { backgroundColor: colors.bgSurfaceNormal }]}>
                <Text style={[styles.zipBadgeText, { color: colors.textSecondary }]}>
                  {t('data_sync.backup_scope_archive_tag', 'ZIP 归档')}
                </Text>
              </View>
            </View>
            {!expanded && (
              <Text
                numberOfLines={1}
                style={[styles.headerSummary, { color: colors.textTertiary }]}
              >
                {t('data_sync.backup_scope_intro')}
              </Text>
            )}
          </View>
        </TouchableOpacity>

        <View style={styles.headerActions}>
          <SyncModeComparisonHelp context="fullBackup" size={16} />
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

      {/* 展开的详情结构区块 */}
      <CollapsibleHeight expanded={expanded} animation="ease" durationMs={250}>
        <View style={[styles.body, { borderTopColor: colors.borderSubtle }]}>
          {/* 1. 概述与机制说明 */}
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
              {t('data_sync.backup_scope_intro')}
            </Text>
          </View>

          {/* 2. 包含项目 */}
          <View style={styles.sectionBlock}>
            <View style={styles.sectionHeader}>
              <CircleCheck size={15} color={colors.success} strokeWidth={2.2} />
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                {t('data_sync.backup_scope_included_heading', '包含内容（打包进备份）')}
              </Text>
            </View>

            <View style={styles.itemsList}>
              {/* Vault 根目录文件树 */}
              <View style={styles.itemRow}>
                <View style={[styles.itemIconBadge, { backgroundColor: colors.primaryContainer }]}>
                  <FolderArchive size={15} color={colors.primary} strokeWidth={2} />
                </View>
                <View style={styles.itemContentCol}>
                  <Text style={[styles.itemPrimaryText, { color: colors.textPrimary }]}>
                    {t('data_sync.backup_scope_root')}
                  </Text>
                </View>
              </View>

              {/* SQLite 数据库与详情 */}
              <View style={styles.itemRow}>
                <View style={[styles.itemIconBadge, { backgroundColor: colors.primaryContainer }]}>
                  <Database size={15} color={colors.primary} strokeWidth={2} />
                </View>
                <View style={styles.itemContentCol}>
                  <Text
                    style={[
                      styles.itemPrimaryText,
                      styles.itemPrimaryBold,
                      { color: colors.textPrimary }
                    ]}
                  >
                    {t('data_sync.backup_scope_database')}
                  </Text>
                  <Text style={[styles.itemSecondaryText, { color: colors.textSecondary }]}>
                    {t('data_sync.backup_scope_database_detail')}
                  </Text>
                </View>
              </View>

              {/* 设备偏好设置 */}
              <View style={styles.itemRow}>
                <View style={[styles.itemIconBadge, { backgroundColor: colors.primaryContainer }]}>
                  <SlidersHorizontal size={15} color={colors.primary} strokeWidth={2} />
                </View>
                <View style={styles.itemContentCol}>
                  <Text style={[styles.itemPrimaryText, { color: colors.textPrimary }]}>
                    {t('data_sync.backup_scope_device_prefs')}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          <View style={[styles.sectionDivider, { backgroundColor: colors.borderSubtle }]} />

          {/* 3. 不包含项目 */}
          <View style={styles.sectionBlock}>
            <View style={styles.sectionHeader}>
              <CircleMinus size={15} color={colors.warning} strokeWidth={2.2} />
              <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                {t('data_sync.backup_scope_excludes_heading')}
              </Text>
            </View>

            <View
              style={[
                styles.excludedCard,
                {
                  backgroundColor: colors.warningContainer,
                  borderLeftColor: colors.warning
                }
              ]}
            >
              <View style={styles.excludedRow}>
                <Text style={[styles.excludedBullet, { color: colors.warning }]}>•</Text>
                <Text style={[styles.excludedText, { color: colors.textPrimary }]}>
                  {t('data_sync.backup_scope_excludes_shadow')}
                </Text>
              </View>
              <View style={styles.excludedRow}>
                <Text style={[styles.excludedBullet, { color: colors.warning }]}>•</Text>
                <Text style={[styles.excludedText, { color: colors.textPrimary }]}>
                  {t('data_sync.backup_scope_excludes_sync_meta')}
                </Text>
              </View>
            </View>
          </View>

          {/* 4. 机制与恢复须知 */}
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
                {t('data_sync.backup_scope_notes_heading', '机制与恢复说明')}
              </Text>
            </View>
            <Text style={[styles.noticeText, { color: colors.textSecondary }]}>
              {t('data_sync.backup_scope_not_incremental')}
            </Text>
            <View style={[styles.noticeDivider, { backgroundColor: colors.borderSubtle }]} />
            <Text style={[styles.noticeText, { color: colors.textSecondary }]}>
              {t('data_sync.backup_scope_import_note')}
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
  zipBadge: {
    paddingHorizontal: sharedTokens.spacing.xsPlus,
    paddingVertical: 2,
    borderRadius: sharedTokens.radius.xs
  },
  zipBadgeText: {
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
    fontSize: 12.5,
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
    fontSize: 13,
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
    flex: 1,
    gap: 2
  },
  itemPrimaryText: {
    fontSize: 13,
    lineHeight: 19
  },
  itemPrimaryBold: {
    fontWeight: '600'
  },
  itemSecondaryText: {
    fontSize: 12,
    lineHeight: 17
  },
  excludedCard: {
    paddingHorizontal: sharedTokens.spacing.mdTight,
    paddingVertical: sharedTokens.spacing.smPlus,
    borderRadius: sharedTokens.radius.md,
    borderLeftWidth: 3,
    gap: sharedTokens.spacing.xsPlus
  },
  excludedRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: sharedTokens.spacing.xsPlus
  },
  excludedBullet: {
    fontSize: 12,
    lineHeight: 18
  },
  excludedText: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 18
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
    fontSize: 12,
    fontWeight: '600'
  },
  noticeText: {
    fontSize: 12,
    lineHeight: 17
  },
  noticeDivider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 2
  }
})
