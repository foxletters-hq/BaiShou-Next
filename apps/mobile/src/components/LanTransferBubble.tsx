import React, { useEffect, useRef } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  Platform,
  Animated,
  Easing,
  type LayoutRectangle
} from 'react-native'
import type { LucideIcon } from 'lucide-react-native'
import { Monitor, Smartphone, TabletSmartphone } from 'lucide-react-native'
import { useTranslation } from 'react-i18next'
import type { DiscoveredDevice } from '@baishou/core-mobile'
import { normalizeLanDeviceType } from '@baishou/shared'
import type { useNativeTheme } from '@baishou/ui/native'
import { styles } from './LanTransferRadarView.styles'

type ThemeColors = ReturnType<typeof useNativeTheme>['colors']

const BUBBLE_OFFSETS = [
  { dx: -0.62, dy: -0.55 },
  { dx: 0.62, dy: -0.42 },
  { dx: 0.0, dy: 0.58 },
  { dx: -0.55, dy: 0.45 },
  { dx: 0.55, dy: 0.48 }
] as const

const FLOAT_DURATION_MS = 4000

export interface LanTransferBubbleProps {
  device: DiscoveredDevice
  index: number
  zone: LayoutRectangle
  center: { x: number; y: number }
  colors: ThemeColors
  isDark: boolean
  isSending: boolean
  sendProgress: number
  onPress: () => void
}

function deviceIcon(device: DiscoveredDevice): LucideIcon {
  const deviceType = normalizeLanDeviceType({
    deviceType: device.deviceType,
    deviceId: device.deviceId,
    nickname: device.nickname
  })
  if (deviceType === 'mobile') return Smartphone
  if (deviceType === 'desktop') return Monitor
  return TabletSmartphone
}

export const LanTransferBubble: React.FC<LanTransferBubbleProps> = ({
  device,
  index,
  zone,
  center,
  colors,
  isDark,
  isSending,
  sendProgress,
  onPress
}) => {
  const { t } = useTranslation()
  const float = useRef(new Animated.Value(0)).current
  const delayMs = index * 500
  const DeviceIcon = deviceIcon(device)

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, {
          toValue: 1,
          duration: FLOAT_DURATION_MS / 2,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true
        }),
        Animated.timing(float, {
          toValue: 0,
          duration: FLOAT_DURATION_MS / 2,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true
        })
      ])
    )
    const timer = setTimeout(() => loop.start(), delayMs)
    return () => {
      clearTimeout(timer)
      loop.stop()
    }
  }, [delayMs, float])

  const translateY = float.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [8, -8, 8]
  })

  const off = BUBBLE_OFFSETS[index % BUBBLE_OFFSETS.length]
  const orbitRadiusX = Math.min(zone.width * 0.36, 145)
  const orbitRadiusY = Math.min(zone.height * 0.32, 160)
  const targetX = center.x + off.dx * orbitRadiusX
  const targetY = center.y + off.dy * orbitRadiusY

  return (
    <Animated.View
      style={[
        styles.bubbleWrap,
        {
          left: targetX,
          top: targetY,
          transform: [{ translateX: -80 }, { translateY }]
        }
      ]}
    >
      <TouchableOpacity
        activeOpacity={0.78}
        onPress={onPress}
        style={[
          styles.bubble,
          {
            backgroundColor: colors.bgSurface,
            borderColor: isSending ? colors.warning : colors.borderSubtle
          },
          isSending && styles.bubbleSending,
          Platform.select({
            ios: {
              shadowColor: '#000',
              shadowOpacity: isDark ? 0.3 : 0.08,
              shadowRadius: 10,
              shadowOffset: { width: 0, height: 3 }
            },
            android: {
              elevation: 4
            },
            default: {}
          })
        ]}
      >
        <View style={styles.bubbleIconContainer}>
          <View style={[styles.bubbleIcon, { backgroundColor: colors.primaryLight }]}>
            <DeviceIcon size={18} color={colors.primary} strokeWidth={2.2} />
          </View>
          <View
            style={[
              styles.statusDot,
              {
                backgroundColor: isSending ? colors.warning : colors.success,
                borderColor: colors.bgSurface
              }
            ]}
          />
        </View>

        <View style={styles.bubbleInfo}>
          <Text style={[styles.bubbleName, { color: colors.textPrimary }]} numberOfLines={1}>
            {device.nickname || t('lan_transfer.unknown_device', '未知设备')}
          </Text>
          <Text style={[styles.bubbleIp, { color: colors.textSecondary }]} numberOfLines={1}>
            {device.ip}
          </Text>
        </View>

        {isSending ? (
          <View style={[styles.sendingBadge, { backgroundColor: colors.primaryLight }]}>
            <Text style={[styles.sendingText, { color: colors.warning }]}>{sendProgress}%</Text>
          </View>
        ) : null}
      </TouchableOpacity>
    </Animated.View>
  )
}
