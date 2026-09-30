import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { PanelLeftOpen } from 'lucide-react-native'
import { useTranslation } from 'react-i18next'
import { AssistantAvatar, useNativeTheme } from '@baishou/ui/native'

interface AgentChatAppBarProps {
  title?: string
  avatarUri?: string | null
  avatarPath?: string | null
  avatarEmoji?: string | null
  costMicros: number
  onMenuPress: () => void
  onCostPress: () => void
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
  onCostPress
}) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const costLabel = `$${(costMicros / 1_000_000).toFixed(4)}`
  const displayTitle = title || t('nav.agent', '伙伴')

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.bgApp,
          borderBottomColor: colors.borderSubtle
        }
      ]}
    >
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
          style={styles.menuBtn}
          onPress={onMenuPress}
          accessibilityLabel={t('agent.sidebar.expand', '展开侧边栏')}
        >
          <PanelLeftOpen size={24} color={colors.textPrimary} strokeWidth={2} />
        </TouchableOpacity>
      </View>

      <View style={[styles.side, styles.sideRight]}>
        <TouchableOpacity
          style={[
            styles.costBadge,
            {
              backgroundColor: colors.bgSurface,
              borderColor: colors.borderMuted
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
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    position: 'relative'
  },
  side: {
    justifyContent: 'center',
    zIndex: 1
  },
  sideLeft: {
    width: LEFT_SIDE_WIDTH,
    alignItems: 'flex-start'
  },
  sideRight: {
    width: RIGHT_SIDE_WIDTH,
    alignItems: 'flex-end',
    paddingRight: 4
  },
  menuBtn: {
    width: 44,
    height: 44,
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
    gap: 8,
    maxWidth: '100%'
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    flexShrink: 1
  },
  costBadge: {
    flexShrink: 1,
    maxWidth: RIGHT_SIDE_WIDTH - 4,
    minWidth: 60,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1
  },
  costText: {
    fontSize: 12,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    textAlign: 'center'
  }
})
