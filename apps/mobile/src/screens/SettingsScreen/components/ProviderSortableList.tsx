import React, { useCallback, useRef, useState } from 'react'
import { View, Text, StyleSheet, Pressable, type LayoutChangeEvent } from 'react-native'
import DraggableFlatList, {
  ScaleDecorator,
  type RenderItemParams
} from 'react-native-draggable-flatlist'
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '@baishou/ui/native'
import { ProviderBrandIcon } from './ProviderBrandIcon'
import type { ProviderListItem } from '../utils/provider-settings'

const ROW_HEIGHT = 52

export interface ProviderSortableListProps {
  items: ProviderListItem[]
  onOpen: (id: string) => void
  onReorder: (items: ProviderListItem[]) => void
  ListFooterComponent?: React.ReactElement | null
}

export const ProviderSortableList: React.FC<ProviderSortableListProps> = ({
  items,
  onOpen,
  onReorder,
  ListFooterComponent
}) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()

  // DraggableFlatList 在 Android 原生 build 上嵌套纯 flex:1 父级时，
  // 内部测量经常算成 0 高度，导致整张列表不可见（标题/页头正常但内容空白）。
  // 用 onLayout 实测外层容器高度后显式传给列表，绕过这个测量 bug。
  const [measuredHeight, setMeasuredHeight] = useState<number | null>(null)
  const measuredHeightRef = useRef<number | null>(null)
  const handleContainerLayout = useCallback((e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height
    if (h > 0 && h !== measuredHeightRef.current) {
      measuredHeightRef.current = h
      setMeasuredHeight(h)
    }
  }, [])

  const renderItem = useCallback(
    ({ item, drag, isActive }: RenderItemParams<ProviderListItem>) => {
      return (
        <ScaleDecorator activeScale={1.02}>
          <View
            style={[
              styles.row,
              {
                backgroundColor: colors.bgSurface,
                borderColor: colors.borderSubtle,
                opacity: isActive ? 0.88 : 1,
                minHeight: ROW_HEIGHT
              }
            ]}
          >
            <Pressable
              style={styles.dragHandle}
              onLongPress={drag}
              delayLongPress={300}
              hitSlop={10}
              accessibilityLabel={t('settings.provider_drag_handle', '长按拖动排序')}
            >
              <MaterialCommunityIcons name="drag-vertical" size={22} color={colors.textTertiary} />
            </Pressable>
            <Pressable style={styles.rowBody} onPress={() => onOpen(item.id)}>
              <ProviderBrandIcon providerId={item.id} size={22} />
              <Text style={[styles.rowName, { color: colors.textPrimary }]} numberOfLines={1}>
                {item.name}
              </Text>
              <View
                style={[
                  styles.statusBadge,
                  {
                    backgroundColor: item.isEnabled ? colors.primaryContainer : colors.bgApp
                  }
                ]}
              >
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: '700',
                    color: item.isEnabled ? colors.primary : colors.textTertiary
                  }}
                >
                  {item.isEnabled ? t('settings.status_on', 'ON') : t('settings.status_off', 'OFF')}
                </Text>
              </View>
              {!item.isSystem && (
                <View style={[styles.customBadge, { borderColor: colors.borderSubtle }]}>
                  <Text style={{ fontSize: 9, color: colors.textTertiary }}>
                    {t('agent.provider.custom_tag', '自定义')}
                  </Text>
                </View>
              )}
              <MaterialIcons name="chevron-right" size={22} color={colors.textTertiary} />
            </Pressable>
          </View>
        </ScaleDecorator>
      )
    },
    [colors, onOpen, t]
  )

  const listHeader = (
    <View style={styles.headerBlock}>
      <Text style={[styles.listHeader, { color: colors.textSecondary }]}>
        {t('ai_config.providers_label', '服务提供商')}
      </Text>
      <Text style={[styles.listHint, { color: colors.textTertiary }]}>
        {t('settings.provider_sort_hint', '长按右侧把手拖动排序')}
      </Text>
    </View>
  )

  return (
    <View style={styles.list} onLayout={handleContainerLayout}>
      <DraggableFlatList
        style={measuredHeight != null ? { height: measuredHeight } : styles.list}
        contentContainerStyle={styles.listContent}
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        onDragEnd={({ data }) => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
          onReorder(data)
        }}
        ListHeaderComponent={listHeader}
        ListFooterComponent={ListFooterComponent}
        activationDistance={12}
        keyboardShouldPersistTaps="handled"
      />
    </View>
  )
}

const styles = StyleSheet.create({
  list: {
    flex: 1
  },
  listContent: {
    paddingBottom: 24
  },
  headerBlock: {
    gap: 4,
    marginBottom: 8
  },
  listHeader: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  listHint: {
    fontSize: 11
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    marginBottom: 6,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth
  },
  dragHandle: {
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    paddingVertical: 12
  },
  rowBody: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingRight: 8
  },
  rowName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600'
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  customBadge: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: StyleSheet.hairlineWidth
  }
})
