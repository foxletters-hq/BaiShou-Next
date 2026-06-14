import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { View, Text, StyleSheet, Pressable, useColorScheme, LayoutAnimation, Platform, UIManager } from 'react-native'
import { ScrollView } from 'react-native-gesture-handler'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring
} from 'react-native-reanimated'
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons'
import { SvgXml } from 'react-native-svg'
import * as Haptics from 'expo-haptics'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '@baishou/ui/native'
import { getCachedProviderIconXml, getProviderIconModule } from '@baishou/ui/native'
import {
  reorderDisabledProviders,
  reorderEnabledProviders,
  splitProviderListItems,
  type ProviderListItem
} from '../utils/provider-settings'

const ROW_HEIGHT = 52
const ROW_GAP = 6
const ROW_STEP = ROW_HEIGHT + ROW_GAP

/** 取消拖拽时快速回位；成功换位时直接归零，避免与列表重排叠加大动画 */
const CANCEL_SPRING = { damping: 22, stiffness: 320, mass: 0.35 }

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true)
}

function animateListReorder(): void {
  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
}

export interface ProviderSortableListProps {
  items: ProviderListItem[]
  onOpen: (id: string) => void
  onReorder: (items: ProviderListItem[]) => void
  ListFooterComponent?: React.ReactElement | null
}

const ProviderListIcon = React.memo(function ProviderListIcon({
  providerId,
  size,
  primaryColor
}: {
  providerId: string
  size: number
  primaryColor: string
}) {
  const isDark = useColorScheme() === 'dark'
  const iconModule = getProviderIconModule(providerId, isDark)
  const xml = iconModule ? getCachedProviderIconXml(iconModule) : undefined
  const wrapSize = size + 8

  return (
    <View
      style={[
        styles.iconWrap,
        { width: wrapSize, height: wrapSize, borderRadius: wrapSize / 4 }
      ]}
    >
      {xml ? (
        <SvgXml xml={xml} width={size} height={size} />
      ) : (
        <Text style={[styles.iconFallback, { color: primaryColor, fontSize: size * 0.55 }]}>
          {providerId.slice(0, 2).toUpperCase()}
        </Text>
      )}
    </View>
  )
})

const DraggableProviderRow = React.memo(function DraggableProviderRow({
  item,
  index,
  itemCount,
  onMove,
  onOpen,
  colors,
  onLabel,
  offLabel
}: {
  item: ProviderListItem
  index: number
  itemCount: number
  onMove: (from: number, to: number) => void
  onOpen: (id: string) => void
  colors: ReturnType<typeof useNativeTheme>['colors']
  onLabel: string
  offLabel: string
}) {
  const translateY = useSharedValue(0)
  const isDragging = useSharedValue(false)

  useLayoutEffect(() => {
    translateY.value = 0
    isDragging.value = false
    // index / item.id 变化时清零拖拽残留（重排落位）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, item.id])

  const finishDrag = useCallback(
    (from: number, to: number) => {
      if (from !== to) {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
        onMove(from, to)
      }
    },
    [onMove]
  )

  const panGesture = useMemo(() => {
    const rowIndex = index
    const count = itemCount
    return Gesture.Pan()
      .activateAfterLongPress(280)
      .onStart(() => {
        isDragging.value = true
      })
      .onUpdate((event) => {
        translateY.value = event.translationY
      })
      .onEnd((event) => {
        isDragging.value = false
        const offset = Math.round(event.translationY / ROW_STEP)
        const to = Math.max(0, Math.min(count - 1, rowIndex + offset))

        if (to === rowIndex) {
          translateY.value = withSpring(0, CANCEL_SPRING)
          return
        }

        // 保持松手时的视觉位置，重排后由 index 变化清零偏移，避免先弹回原位再跳转
        translateY.value = (to - rowIndex) * ROW_STEP
        runOnJS(finishDrag)(rowIndex, to)
      })
      .onFinalize(() => {
        if (isDragging.value) {
          isDragging.value = false
          translateY.value = withSpring(0, CANCEL_SPRING)
        }
      })
    // shared values are stable refs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finishDrag, index, itemCount])

  const rowStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    zIndex: isDragging.value ? 20 : 0,
    opacity: isDragging.value ? 0.92 : 1
  }))

  return (
    <Animated.View
      style={[
        styles.row,
        rowStyle,
        {
          backgroundColor: colors.bgSurface,
          borderColor: colors.borderSubtle,
          minHeight: ROW_HEIGHT
        }
      ]}
    >
      <GestureDetector gesture={panGesture}>
        <View style={styles.dragHandle} accessibilityRole="button">
          <MaterialCommunityIcons name="drag-vertical" size={22} color={colors.textTertiary} />
        </View>
      </GestureDetector>
      <Pressable style={styles.rowBody} onPress={() => onOpen(item.id)}>
        <ProviderListIcon providerId={item.id} size={22} primaryColor={colors.primary} />
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
            {item.isEnabled ? onLabel : offLabel}
          </Text>
        </View>
        {!item.isSystem && (
          <View style={[styles.customBadge, { borderColor: colors.borderSubtle }]}>
            <Text style={{ fontSize: 9, color: colors.textTertiary }}>自定义</Text>
          </View>
        )}
        <MaterialIcons name="chevron-right" size={22} color={colors.textTertiary} />
      </Pressable>
    </Animated.View>
  )
})

const ProviderGroupList = React.memo(function ProviderGroupList({
  data,
  onReorder,
  onOpen,
  colors,
  onLabel,
  offLabel
}: {
  data: ProviderListItem[]
  onReorder: (items: ProviderListItem[]) => void
  onOpen: (id: string) => void
  colors: ReturnType<typeof useNativeTheme>['colors']
  onLabel: string
  offLabel: string
}) {
  const [localData, setLocalData] = useState(data)

  useEffect(() => {
    setLocalData(data)
  }, [data])

  const handleMove = useCallback(
    (from: number, to: number) => {
      if (from === to) return
      animateListReorder()

      let reordered: ProviderListItem[] | undefined
      setLocalData((prev) => {
        const next = [...prev]
        const [removed] = next.splice(from, 1)
        if (!removed) return prev
        next.splice(to, 0, removed)
        reordered = next
        return next
      })

      if (reordered) {
        onReorder(reordered)
      }
    },
    [onReorder]
  )

  if (localData.length === 0) return null

  return (
    <View style={styles.groupList}>
      {localData.map((item, index) => (
        <DraggableProviderRow
          key={item.id}
          item={item}
          index={index}
          itemCount={localData.length}
          onMove={handleMove}
          onOpen={onOpen}
          colors={colors}
          onLabel={onLabel}
          offLabel={offLabel}
        />
      ))}
    </View>
  )
})

export const ProviderSortableList = React.memo(function ProviderSortableList({
  items,
  onOpen,
  onReorder,
  ListFooterComponent
}: ProviderSortableListProps) {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()

  const onLabel = t('settings.status_on', 'ON')
  const offLabel = t('settings.status_off', 'OFF')

  const { enabled: enabledItems, disabled: disabledItems } = useMemo(
    () => splitProviderListItems(items),
    [items]
  )

  const handleEnabledReorder = useCallback(
    (data: ProviderListItem[]) => {
      onReorder(reorderEnabledProviders(items, data))
    },
    [items, onReorder]
  )

  const handleDisabledReorder = useCallback(
    (data: ProviderListItem[]) => {
      onReorder(reorderDisabledProviders(items, data))
    },
    [items, onReorder]
  )

  return (
    <ScrollView
      style={styles.list}
      contentContainerStyle={styles.listContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.headerBlock}>
        <Text style={[styles.listHeader, { color: colors.textSecondary }]}>
          {t('ai_config.providers_label', '服务提供商')}
        </Text>
        <Text style={[styles.listHint, { color: colors.textTertiary }]}>
          {t('settings.provider_sort_hint', '长按左侧把手，在同组内拖动排序')}
        </Text>
      </View>

      {enabledItems.length > 0 && (
        <>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
            {t('settings.provider_group_enabled', '已启用')}
          </Text>
          <ProviderGroupList
            data={enabledItems}
            onReorder={handleEnabledReorder}
            onOpen={onOpen}
            colors={colors}
            onLabel={onLabel}
            offLabel={offLabel}
          />
        </>
      )}

      {enabledItems.length > 0 && disabledItems.length > 0 && (
        <View style={styles.dividerBlock}>
          <View style={[styles.dividerLine, { backgroundColor: colors.borderSubtle }]} />
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
            {t('settings.provider_group_disabled', '未启用')}
          </Text>
        </View>
      )}

      {disabledItems.length > 0 && (
        <>
          {enabledItems.length === 0 && (
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
              {t('settings.provider_group_disabled', '未启用')}
            </Text>
          )}
          <ProviderGroupList
            data={disabledItems}
            onReorder={handleDisabledReorder}
            onOpen={onOpen}
            colors={colors}
            onLabel={onLabel}
            offLabel={offLabel}
          />
        </>
      )}

      {ListFooterComponent}
    </ScrollView>
  )
})

const styles = StyleSheet.create({
  list: {
    flex: 1
  },
  listContent: {
    paddingBottom: 24
  },
  groupList: {
    flexGrow: 0
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
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: 4,
    marginBottom: 6,
    paddingHorizontal: 2
  },
  dividerBlock: {
    marginTop: 8,
    marginBottom: 2,
    gap: 8
  },
  dividerLine: {
    height: StyleSheet.hairlineWidth,
    alignSelf: 'stretch'
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    marginBottom: ROW_GAP,
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
  },
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF'
  },
  iconFallback: {
    fontWeight: '700'
  }
})
