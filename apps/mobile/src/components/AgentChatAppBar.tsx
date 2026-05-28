import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '@baishou/ui/native'

interface AgentChatAppBarProps {
  modelName: string
  costMicros: number
  onMenuPress: () => void
  onModelPress: () => void
  onCostPress: () => void
}

const SIDE_WIDTH = 88

export const AgentChatAppBar: React.FC<AgentChatAppBarProps> = ({
  modelName,
  costMicros,
  onMenuPress,
  onModelPress,
  onCostPress
}) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const showCost = costMicros > 0
  const costLabel = `$${(costMicros / 1_000_000).toFixed(4)}`
  const displayModel =
    modelName || t('agent.no_model_selected', '暂未选择模型')

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.bgSurface,
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
          <MaterialIcons name="menu" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.titleWrap} onPress={onModelPress} activeOpacity={0.7}>
        <Text style={[styles.modelName, { color: colors.textPrimary }]} numberOfLines={1}>
          {displayModel}
        </Text>
        <MaterialIcons name="unfold-more" size={18} color={colors.textSecondary} />
      </TouchableOpacity>

      <View style={[styles.side, styles.sideRight]}>
        {showCost ? (
          <TouchableOpacity
            style={[styles.costBadge, { backgroundColor: colors.bgSurfaceHighest }]}
            onPress={onCostPress}
            accessibilityLabel={t('agent.chat.cost_detail_title', '当前计费')}
          >
            <Text style={[styles.costText, { color: colors.textSecondary }]}>{costLabel}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    paddingHorizontal: 4,
    borderBottomWidth: 1
  },
  side: {
    width: SIDE_WIDTH,
    justifyContent: 'center'
  },
  sideLeft: {
    alignItems: 'flex-start'
  },
  sideRight: {
    alignItems: 'flex-end',
    paddingRight: 8
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
    gap: 4,
    paddingHorizontal: 4
  },
  modelName: {
    fontSize: 16,
    fontWeight: '700',
    maxWidth: '78%',
    textAlign: 'center'
  },
  costBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6
  },
  costText: {
    fontSize: 12,
    fontWeight: '700',
    fontVariant: ['tabular-nums']
  }
})
