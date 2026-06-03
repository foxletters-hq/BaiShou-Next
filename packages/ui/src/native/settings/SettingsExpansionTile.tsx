import React, { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming
} from 'react-native-reanimated'
import { useNativeTheme } from '../theme'
import { settingsHubListStyles as hubStyles } from './settings-hub.styles'
import { CollapsibleHeight } from './CollapsibleHeight'

const SLIDE_MS = 280

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
  const chevronRotation = useSharedValue(0)

  useEffect(() => {
    chevronRotation.value = withTiming(open ? 1 : 0, {
      duration: SLIDE_MS,
      easing: Easing.bezier(0.4, 0, 0.2, 1)
    })
  }, [open, chevronRotation])

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${chevronRotation.value * 90}deg` }]
  }))

  const toggle = () => {
    setOpen((prev) => !prev)
  }

  const showRowDivider = embedded && (!isLast || open)

  const header = (
    <TouchableOpacity
      onPress={toggle}
      activeOpacity={0.65}
      hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
      style={[
        hubStyles.row,
        embedded &&
          showRowDivider && [hubStyles.rowDivider, { borderBottomColor: colors.borderSubtle }],
        !embedded && {
          paddingHorizontal: 14,
          paddingVertical: 13
        }
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
      <Animated.Text
        style={[hubStyles.hubChevron, { color: colors.textTertiary }, chevronStyle]}
      >
        ›
      </Animated.Text>
    </TouchableOpacity>
  )

  const bodyInner = (
    <View
      style={[
        embedded ? styles.embeddedBody : styles.standaloneBody,
        embedded && !isLast
          ? { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderSubtle }
          : null
      ]}
    >
      {children}
    </View>
  )

  if (embedded) {
    return (
      <View>
        {header}
        <CollapsibleHeight expanded={open}>{bodyInner}</CollapsibleHeight>
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
      <CollapsibleHeight expanded={open}>{bodyInner}</CollapsibleHeight>
    </View>
  )
}

const styles = StyleSheet.create({
  embeddedBody: {
    paddingHorizontal: 14,
    paddingBottom: 14
  },
  standaloneBody: {
    paddingHorizontal: 16,
    paddingBottom: 16
  }
})
