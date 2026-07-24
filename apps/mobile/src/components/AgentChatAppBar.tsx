import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { PanelLeftOpen } from 'lucide-react-native'
import { useTranslation } from 'react-i18next'
import { ProviderBrandIcon, useNativeTheme } from '@baishou/ui/native'
import { isConfiguredProviderId } from '@baishou/shared'

interface AgentChatAppBarProps {
  modelName: string
  providerId?: string | null
  providerType?: string
  costMicros: number
  onMenuPress: () => void
  onModelPress: () => void
  onCostPress: () => void
}

const LEFT_SIDE_WIDTH = 48
const RIGHT_SIDE_WIDTH = 76

export const AgentChatAppBar: React.FC<AgentChatAppBarProps> = ({
  modelName,
  providerId,
  providerType,
  costMicros,
  onMenuPress,
  onModelPress,
  onCostPress
}) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const costLabel = `$${(costMicros / 1_000_000).toFixed(4)}`
  const displayModel = modelName || t('agent.no_model_selected', '暂未选择模型')
  const showProviderIcon = isConfiguredProviderId(providerId)

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
      <View style={[styles.side, styles.sideLeft]}>
        <TouchableOpacity
          style={styles.menuBtn}
          onPress={onMenuPress}
          accessibilityLabel={t('agent.sidebar.expand', '展开侧边栏')}
        >
          <PanelLeftOpen size={24} color={colors.textPrimary} strokeWidth={2} />
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.titleWrap} onPress={onModelPress} activeOpacity={0.7}>
        <View style={styles.modelCluster}>
          {showProviderIcon ? (
            <ProviderBrandIcon providerId={providerId!} providerType={providerType} size={18} />
          ) : null}
          <Text style={[styles.modelName, { color: colors.textPrimary }]} numberOfLines={1}>
            {displayModel}
          </Text>
        </View>
      </TouchableOpacity>

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
    minHeight: 48,
    paddingHorizontal: 4,
    borderBottomWidth: 1
  },
  side: {
    justifyContent: 'center'
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
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
    minWidth: 0
  },
  modelCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
    maxWidth: '100%'
  },
  modelName: {
    fontSize: 16,
    fontWeight: '500',
    flexShrink: 1,
    textAlign: 'left'
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
