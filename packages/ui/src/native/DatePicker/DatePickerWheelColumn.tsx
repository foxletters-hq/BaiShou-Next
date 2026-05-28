import React, { useRef, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  NativeSyntheticEvent,
  NativeScrollEvent,
  type ScrollView as ScrollViewType
} from 'react-native'
import { useNativeTheme } from '../theme'
import { WHEEL_ITEM_HEIGHT, WHEEL_PAD_COUNT, offsetToScrollIndex, scrollIndexToOffset } from './date-picker.utils'

export interface DatePickerWheelColumnProps {
  items: string[]
  selectedIndex: number
  onIndexChange: (index: number) => void
  scrollKey: string
}

export const DatePickerWheelColumn: React.FC<DatePickerWheelColumnProps> = ({
  items,
  selectedIndex,
  onIndexChange,
  scrollKey
}) => {
  const { colors } = useNativeTheme()
  const scrollRef = useRef<ScrollViewType>(null)
  const pad = WHEEL_ITEM_HEIGHT * WHEEL_PAD_COUNT
  const isUserScroll = useRef(false)

  const scrollToIndex = useCallback((index: number, animated: boolean) => {
    const clamped = Math.max(0, Math.min(index, items.length - 1))
    scrollRef.current?.scrollTo({
      y: scrollIndexToOffset(clamped),
      animated
    })
  }, [items.length])

  useEffect(() => {
    if (isUserScroll.current) return
    const id = requestAnimationFrame(() => {
      scrollToIndex(selectedIndex, false)
    })
    return () => cancelAnimationFrame(id)
  }, [scrollKey, selectedIndex, items.length, scrollToIndex])

  const handleScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    isUserScroll.current = true
    const index = offsetToScrollIndex(e.nativeEvent.contentOffset.y)
    const clamped = Math.max(0, Math.min(index, items.length - 1))
    scrollRef.current?.scrollTo({ y: scrollIndexToOffset(clamped), animated: true })
    onIndexChange(clamped)
    requestAnimationFrame(() => {
      isUserScroll.current = false
    })
  }

  return (
    <View style={styles.column}>
      <View
        pointerEvents="none"
        style={[
          styles.selectionBand,
          {
            top: WHEEL_ITEM_HEIGHT * WHEEL_PAD_COUNT,
            height: WHEEL_ITEM_HEIGHT,
            borderColor: colors.borderSubtle,
            backgroundColor: colors.primaryLight
          }
        ]}
      />
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={WHEEL_ITEM_HEIGHT}
        decelerationRate="fast"
        nestedScrollEnabled
        onMomentumScrollEnd={handleScrollEnd}
        onScrollEndDrag={handleScrollEnd}
        contentContainerStyle={{ paddingVertical: pad }}
      >
        {items.map((label, index) => {
          const active = index === selectedIndex
          return (
            <View key={`${scrollKey}-${index}`} style={styles.item}>
              <Text
                style={[
                  styles.itemText,
                  {
                    color: active ? colors.primary : colors.textSecondary,
                    fontWeight: active ? '700' : '400',
                    fontSize: active ? 18 : 16
                  }
                ]}
                numberOfLines={1}
              >
                {label}
              </Text>
            </View>
          )
        })}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  column: {
    flex: 1,
    height: WHEEL_ITEM_HEIGHT * (WHEEL_PAD_COUNT * 2 + 1),
    position: 'relative'
  },
  selectionBand: {
    position: 'absolute',
    left: 4,
    right: 4,
    borderRadius: 10,
    borderWidth: 1,
    zIndex: 0
  },
  item: {
    height: WHEEL_ITEM_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4
  },
  itemText: {
    textAlign: 'center'
  }
})
