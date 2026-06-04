import React, { useEffect, useRef, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
  type LayoutRectangle
} from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import type { DiscoveredDevice } from '@baishou/core-mobile'
import { useNativeTheme } from '@baishou/ui/native'

type ThemeColors = ReturnType<typeof useNativeTheme>['colors']

/** 与 Flutter RadarPainter 一致：固定三圈半径（逻辑像素） */
const RING_RADII = [100, 200, 300] as const

const BUBBLE_OFFSETS = [
  { dx: -0.6, dy: -0.6 },
  { dx: 0.6, dy: -0.4 },
  { dx: 0.0, dy: 0.6 },
  { dx: -0.5, dy: 0.5 },
  { dx: 0.5, dy: 0.5 }
] as const

const PULSE_DURATION_MS = 2000
const FLOAT_DURATION_MS = 4000

export interface LanTransferRadarViewProps {
  devices: DiscoveredDevice[]
  isDiscovering: boolean
  sendingTo: string | null
  sendProgress: number
  onDevicePress: (device: DiscoveredDevice) => void
}

function deviceIconName(device: DiscoveredDevice): keyof typeof MaterialIcons.glyphMap {
  if (device.deviceType === 'mobile') return 'smartphone'
  if (device.deviceType === 'desktop') return 'computer'
  const name = device.nickname.toLowerCase()
  if (name.includes('iphone') || name.includes('phone') || name.includes('android')) {
    return 'smartphone'
  }
  if (name.includes('macbook') || name.includes('desktop') || name.includes('pc')) {
    return 'computer'
  }
  return 'devices'
}

const FloatingBubble: React.FC<{
  device: DiscoveredDevice
  index: number
  zone: LayoutRectangle
  colors: ThemeColors
  isSending: boolean
  sendProgress: number
  onPress: () => void
}> = ({ device, index, zone, colors, isSending, sendProgress, onPress }) => {
  const float = useRef(new Animated.Value(0)).current
  const delayMs = index * 500

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
    outputRange: [10, -10, 10]
  })

  const off = BUBBLE_OFFSETS[index % BUBBLE_OFFSETS.length]
  const cx = zone.width / 2
  const cy = zone.height / 2
  const left = cx + off.dx * (zone.width * 0.35) - 80
  const top = cy + off.dy * (zone.height * 0.35) - 48

  return (
    <Animated.View
      style={[
        styles.bubbleWrap,
        {
          left,
          top,
          transform: [{ translateY }]
        }
      ]}
    >
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={onPress}
        style={[
          styles.bubble,
          {
            backgroundColor: colors.bgGlassSurface,
            borderColor: isSending ? colors.primary : colors.borderMuted
          },
          isSending && { opacity: 0.95 }
        ]}
      >
        <View style={[styles.bubbleIconBox, { backgroundColor: colors.primaryLight }]}>
          <MaterialIcons name={deviceIconName(device)} size={24} color={colors.primary} />
        </View>
        <Text style={[styles.bubbleName, { color: colors.textPrimary }]} numberOfLines={1}>
          {isSending ? `${sendProgress}%` : device.nickname}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  )
}

const PulseCore: React.FC<{ colors: ThemeColors }> = ({ colors }) => {
  const pulse = useRef(new Animated.Value(0)).current

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: PULSE_DURATION_MS / 2,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: PULSE_DURATION_MS / 2,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true
        })
      ])
    )
    anim.start()
    return () => anim.stop()
  }, [pulse])

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.2] })

  return (
    <Animated.View
      style={[
        styles.pulseOuter,
        {
          backgroundColor: colors.primaryLight,
          transform: [{ scale }]
        }
      ]}
    >
      <View style={[styles.pulseInner, { backgroundColor: colors.primary }]}>
        <MaterialIcons name="cell-tower" size={22} color={colors.textOnPrimary} />
      </View>
    </Animated.View>
  )
}

export const LanTransferRadarView: React.FC<LanTransferRadarViewProps> = ({
  devices,
  isDiscovering,
  sendingTo,
  sendProgress,
  onDevicePress
}) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const [zone, setZone] = useState<LayoutRectangle | null>(null)

  const scale = zone != null ? Math.min(zone.width, zone.height) / (RING_RADII[2] * 2 + 40) : 1

  return (
    <View
      style={[styles.root, { backgroundColor: colors.bgApp }]}
      onLayout={(e) => setZone(e.nativeEvent.layout)}
    >
      {zone != null && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {RING_RADII.map((r) => {
            const diameter = r * 2 * scale
            return (
              <View
                key={r}
                style={[
                  styles.ring,
                  {
                    width: diameter,
                    height: diameter,
                    borderRadius: diameter / 2,
                    borderColor: colors.borderSubtle,
                    left: zone.width / 2 - diameter / 2,
                    top: zone.height / 2 - diameter / 2
                  }
                ]}
              />
            )
          })}
        </View>
      )}

      <View style={styles.coreWrap} pointerEvents="none">
        <PulseCore colors={colors} />
      </View>

      {isDiscovering && devices.length === 0 && (
        <View style={styles.scanHint} pointerEvents="none">
          <Text style={[styles.scanTitle, { color: colors.textPrimary }]}>
            {t('lan_transfer.scanning_nearby')}
          </Text>
          <Text style={[styles.scanSubtitle, { color: colors.textSecondary }]}>
            {t('lan_transfer.scan_hint')}
          </Text>
        </View>
      )}

      {zone != null &&
        devices
          .slice(0, 5)
          .map((device, index) => (
            <FloatingBubble
              key={device.rawServiceId}
              device={device}
              index={index}
              zone={zone}
              colors={colors}
              isSending={sendingTo === device.rawServiceId}
              sendProgress={sendProgress}
              onPress={() => onDevicePress(device)}
            />
          ))}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  ring: {
    position: 'absolute',
    borderWidth: 1
  },
  coreWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center'
  },
  pulseOuter: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center'
  },
  pulseInner: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4
  },
  scanHint: {
    position: 'absolute',
    bottom: 120,
    left: 24,
    right: 24,
    alignItems: 'center'
  },
  scanTitle: { fontSize: 20, fontWeight: '700', marginBottom: 8 },
  scanSubtitle: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  bubbleWrap: {
    position: 'absolute',
    zIndex: 10
  },
  bubble: {
    paddingHorizontal: 24,
    paddingVertical: 24,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    minWidth: 120,
    maxWidth: 200,
    elevation: 6
  },
  bubbleIconBox: {
    padding: 12,
    borderRadius: 16,
    marginBottom: 8
  },
  bubbleName: {
    fontSize: 14,
    fontWeight: '500',
    maxWidth: 140,
    textAlign: 'center'
  }
})
