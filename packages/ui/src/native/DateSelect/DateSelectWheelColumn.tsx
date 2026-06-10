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
import {
  WHEEL_ITEM_HEIGHT,
  WHEEL_PAD_COUNT,
  offsetToScrollIndex,
  scrollIndexToOffset
} from './date-select.utils'

export interface DateSelectWheelColumnProps {
  items: string[]
  selectedIndex: number
  onIndexChange: (index: number) => void
  scrollKey: string
  selectionBandColor?: string
}

export const DateSelectWheelColumn: React.FC<DateSelectWheelColumnProps> = ({
  items,
  selectedIndex,
  onIndexChange,
  scrollKey,
  selectionBandColor
}) => {
  const { colors } = useNativeTheme()
  const scrollRef = useRef<ScrollViewType>(null)
  const pad = WHEEL_ITEM_HEIGHT * WHEEL_PAD_COUNT
  const isUserScroll = useRef(false)
  const dragEndTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSettledIndex = useRef(selectedIndex)

  const scrollToIndex = useCallback(
    (index: number) => {
      const clamped = Math.max(0, Math.min(index, items.length - 1))
      scrollRef.current?.scrollTo({
        y: scrollIndexToOffset(clamped),
        animated: false
      })
    },
    [items.length]
  )

  useEffect(() => {
    lastSettledIndex.current = selectedIndex
  }, [scrollKey, selectedIndex])

  useEffect(() => {
    if (isUserScroll.current) return
    const id = requestAnimationFrame(() => {
      scrollToIndex(selectedIndex)
    })
    return () => cancelAnimationFrame(id)
  }, [scrollKey, selectedIndex, items.length, scrollToIndex])

  const settleAtOffset = useCallback(
    (offsetY: number) => {
      const index = offsetToScrollIndex(offsetY)
      const clamped = Math.max(0, Math.min(index, items.length - 1))
      const targetY = scrollIndexToOffset(clamped)

      if (Math.abs(offsetY - targetY) > 0.5) {
        scrollRef.current?.scrollTo({ y: targetY, animated: false })
      }

      if (clamped !== lastSettledIndex.current) {
        lastSettledIndex.current = clamped
        onIndexChange(clamped)
      }
    },
    [items.length, onIndexChange]
  )

  const handleScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      isUserScroll.current = true
      settleAtOffset(e.nativeEvent.contentOffset.y)
      setTimeout(() => {
        isUserScroll.current = false
      }, 320)
    },
    [settleAtOffset]
  )

  const clearDragEndTimer = useCallback(() => {
    if (dragEndTimer.current) {
      clearTimeout(dragEndTimer.current)
      dragEndTimer.current = null
    }
  }, [])

  const handleScrollBeginDrag = useCallback(() => {
    clearDragEndTimer()
    isUserScroll.current = true
  }, [clearDragEndTimer])

  const handleScrollEndDrag = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const event = e
      clearDragEndTimer()
      dragEndTimer.current = setTimeout(() => {
        dragEndTimer.current = null
        handleScrollEnd(event)
      }, 80)
    },
    [clearDragEndTimer, handleScrollEnd]
  )

  const handleMomentumScrollBegin = useCallback(() => {
    clearDragEndTimer()
  }, [clearDragEndTimer])

  useEffect(() => () => clearDragEndTimer(), [clearDragEndTimer])

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
            backgroundColor: selectionBandColor ?? colors.primaryLight
          }
        ]}
      />
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        bounces={false}
        alwaysBounceVertical={false}
        overScrollMode="never"
        snapToInterval={WHEEL_ITEM_HEIGHT}
        decelerationRate="normal"
        nestedScrollEnabled
        scrollEventThrottle={16}
        onScrollBeginDrag={handleScrollBeginDrag}
        onScrollEndDrag={handleScrollEndDrag}
        onMomentumScrollBegin={handleMomentumScrollBegin}
        onMomentumScrollEnd={handleScrollEnd}
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
  scroll: {
    flex: 1,
    zIndex: 1
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
