import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Menu } from 'lucide-react-native'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { AssistantAvatar, useNativeTheme } from '@baishou/ui/native'
import { mobileTypography, sharedTokens } from '@baishou/ui/theme/tokens'

interface AgentChatAppBarProps {
  title?: string
  avatarUri?: string | null
  avatarPath?: string | null
  avatarEmoji?: string | null
  costMicros: number
  onMenuPress: () => void
  onCostPress: () => void
  hasChatBackground?: boolean
  /** @deprecated 顶部不再作为模型选择器 */
  modelName?: string
  providerId?: string | null
  providerType?: string
  onModelPress?: () => void
}

const LEFT_SIDE_WIDTH = 48
const RIGHT_SIDE_WIDTH = 76

export const AgentChatAppBar: React.FC<AgentChatAppBarProps> = ({
  title,
  avatarUri,
  avatarPath,
  avatarEmoji,
  costMicros,
  onMenuPress,
  onCostPress,
  hasChatBackground = false
}) => {
  const { t } = useTranslation()
  const { colors, isDark } = useNativeTheme()
  const insets = useSafeAreaInsets()
  const costLabel = `$${(costMicros / 1_000_000).toFixed(4)}`
  const displayTitle = title || t('nav.agent', '伙伴')
  const topInset = hasChatBackground ? insets.top : 0

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: topInset,
          backgroundColor: hasChatBackground
            ? isDark
              ? 'rgba(26, 26, 30, 0.75)'
              : 'rgba(255, 255, 255, 0.75)'
            : colors.bgApp,
          borderBottomColor: hasChatBackground
            ? isDark
              ? 'rgba(255, 255, 255, 0.08)'
              : 'rgba(0, 0, 0, 0.06)'
            : colors.borderSubtle
        }
      ]}
    >
      <View style={styles.contentRow}>
        <View style={styles.titleWrap} pointerEvents="box-none">
          <View style={styles.partnerCluster}>
            <AssistantAvatar
              emoji={avatarEmoji}
              avatarPath={avatarPath}
              resolvedAvatarUri={avatarUri}
              size={24}
            />
            <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>
              {displayTitle}
            </Text>
          </View>
        </View>

        <View style={[styles.side, styles.sideLeft]}>
          <TouchableOpacity
            style={[
              styles.menuBtn,
              {
                backgroundColor: hasChatBackground
                  ? isDark
                    ? 'rgba(255, 255, 255, 0.12)'
                    : 'rgba(255, 255, 255, 0.65)'
                  : colors.bgSurface,
                borderColor: hasChatBackground
                  ? isDark
                    ? 'rgba(255, 255, 255, 0.15)'
                    : 'rgba(0, 0, 0, 0.08)'
                  : colors.borderMuted
              }
            ]}
            onPress={onMenuPress}
            activeOpacity={0.85}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={t('agent.sidebar.expand', '展开侧边栏')}
          >
            <Menu size={18} color={colors.textPrimary} strokeWidth={2} />
          </TouchableOpacity>
        </View>

        <View style={[styles.side, styles.sideRight]}>
          <TouchableOpacity
            style={[
              styles.costBadge,
              {
                backgroundColor: hasChatBackground
                  ? isDark
                    ? 'rgba(255, 255, 255, 0.12)'
                    : 'rgba(255, 255, 255, 0.65)'
                  : colors.bgSurface,
                borderColor: hasChatBackground
                  ? isDark
                    ? 'rgba(255, 255, 255, 0.15)'
                    : 'rgba(0, 0, 0, 0.08)'
                  : colors.borderMuted
              }
            ]}
            onPress={onCostPress}
            activeOpacity={0.85}
            accessibilityLabel={t('agent.chat.cost_detail_title', '当前计费')}
          >
            <Text style={[styles.costText, { color: colors.textPrimary }]} numberOfLines={1}>
              {costLabel}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: 1,
    position: 'relative',
    zIndex: 10
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
    paddingHorizontal: sharedTokens.spacing.xs,
    position: 'relative'
  },
  side: {
    justifyContent: 'center',
    zIndex: 1
  },
  sideLeft: {
    width: LEFT_SIDE_WIDTH,
    alignItems: 'flex-start',
    paddingLeft: sharedTokens.spacing.xs
  },
  sideRight: {
    width: RIGHT_SIDE_WIDTH,
    alignItems: 'flex-end',
    paddingRight: sharedTokens.spacing.xs
  },
  menuBtn: {
    width: 36,
    height: 32,
    borderRadius: sharedTokens.radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  titleWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 80,
    zIndex: 0
  },
  partnerCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: sharedTokens.spacing.sm,
    maxWidth: '100%'
  },
  title: {
    fontSize: mobileTypography.primary.fontSize,
    fontWeight: '600',
    textAlign: 'center',
    flexShrink: 1
  },
  costBadge: {
    flexShrink: 1,
    maxWidth: RIGHT_SIDE_WIDTH - 4,
    minWidth: 60,
    paddingHorizontal: sharedTokens.spacing.sm,
    paddingVertical: sharedTokens.spacing.xsPlus,
    borderRadius: sharedTokens.radius.md,
    borderWidth: 1
  },
  costText: {
    fontSize: mobileTypography.caption.fontSize,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    textAlign: 'center'
  }
})
