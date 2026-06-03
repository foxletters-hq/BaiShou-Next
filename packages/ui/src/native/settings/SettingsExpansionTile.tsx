import React, { useCallback, useEffect, useState } from 'react'
import { View, Text, Pressable, StyleSheet, LayoutChangeEvent } from 'react-native'
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming
} from 'react-native-reanimated'
import { useNativeTheme } from '../theme'
import { settingsHubListStyles as hubStyles } from './settings-hub.styles'

const EXPAND_MS = 420

export interface SettingsExpansionTileProps {
  title: string
  subtitle?: string
  children: React.ReactNode
  embedded?: boolean
  isLast?: boolean
}

export const SettingsExpansionTile: React.FC<SettingsExpansionTileProps> = ({
  title,
  subtitle,
  children,
  embedded = false,
  isLast = false
}) => {
  const { colors, tokens } = useNativeTheme()
  const [open, setOpen] = useState(false)
  const [contentHeight, setContentHeight] = useState(0)

  const animatedHeight = useSharedValue(0)
  const animatedOpacity = useSharedValue(0)

  const finishClose = useCallback(() => {
    setOpen(false)
  }, [])

  const onMeasureLayout = (event: LayoutChangeEvent) => {
    const nextHeight = event.nativeEvent.layout.height
    if (nextHeight <= 0) return
    setContentHeight((prev) => (Math.abs(prev - nextHeight) > 1 ? nextHeight : prev))
  }

  useEffect(() => {
    if (!open || contentHeight <= 0) return
    animatedHeight.value = withTiming(contentHeight, {
      duration: EXPAND_MS,
      easing: Easing.bezier(0.4, 0, 0.2, 1)
    })
    animatedOpacity.value = withTiming(1, {
      duration: EXPAND_MS,
      easing: Easing.out(Easing.cubic)
    })
  }, [open, contentHeight, animatedHeight, animatedOpacity])

  const toggle = () => {
    if (!open) {
      setOpen(true)
      return
    }

    animatedHeight.value = withTiming(0, {
      duration: EXPAND_MS,
      easing: Easing.bezier(0.4, 0, 0.2, 1)
    })
    animatedOpacity.value = withTiming(
      0,
      {
        duration: EXPAND_MS,
        easing: Easing.in(Easing.cubic)
      },
      (finished) => {
        if (finished) {
          runOnJS(finishClose)()
        }
      }
    )
  }

  const bodyAnimatedStyle = useAnimatedStyle(() => ({
    height: open ? animatedHeight.value : 0,
    opacity: animatedOpacity.value
  }))

  const showRowDivider = embedded && (!isLast || open)

  const header = (
    <Pressable
      onPress={toggle}
      style={({ pressed }) => [
        hubStyles.row,
        embedded &&
          showRowDivider && [hubStyles.rowDivider, { borderBottomColor: colors.borderSubtle }],
        !embedded && {
          paddingHorizontal: 14,
          paddingVertical: 13
        },
        { opacity: pressed ? 0.7 : 1 }
      ]}
    >
      <View style={{ flex: 1 }}>
        <Text style={[hubStyles.rowTitle, { color: colors.textPrimary }]}>{title}</Text>
        {subtitle ? (
          <Text
            style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2, fontWeight: '400' }}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      <Text
        style={[
          styles.chevron,
          { color: colors.textTertiary, transform: [{ rotate: open ? '180deg' : '0deg' }] }
        ]}
      >
        ▾
      </Text>
    </Pressable>
  )

  const bodyInner = (
    <View
      style={[
        embedded ? styles.embeddedBody : styles.standaloneBody,
        embedded && !isLast && open
          ? { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderSubtle }
          : null
      ]}
    >
      {children}
    </View>
  )

  const body = (
    <>
      <View style={styles.measureWrap} pointerEvents="none" collapsable={false}>
        <View onLayout={onMeasureLayout} collapsable={false}>
          {bodyInner}
        </View>
      </View>
      <Animated.View style={[styles.bodyClip, bodyAnimatedStyle]} collapsable={false}>
        {open ? bodyInner : null}
      </Animated.View>
    </>
  )

  if (embedded) {
    return (
      <View>
        {header}
        {body}
      </View>
    )
  }

  return (
    <View
      style={{
        marginBottom: 12,
        backgroundColor: colors.bgSurface,
        borderRadius: tokens.radius.lg,
        overflow: 'hidden'
      }}
    >
      {header}
      {body}
    </View>
  )
}

const styles = StyleSheet.create({
  chevron: {
    fontSize: 14,
    width: 18,
    textAlign: 'center'
  },
  measureWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    opacity: 0,
    zIndex: -1
  },
  bodyClip: {
    overflow: 'hidden'
  },
  embeddedBody: {
    paddingHorizontal: 14,
    paddingBottom: 14
  },
  standaloneBody: {
    paddingHorizontal: 16,
    paddingBottom: 16
  }
})
