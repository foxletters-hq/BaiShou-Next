import React, { useEffect, useRef, useState, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Platform,
  Animated,
  Easing,
  useWindowDimensions,
  type LayoutRectangle,
  type LayoutChangeEvent
} from 'react-native'
import { Radar, Wifi } from 'lucide-react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import type { DiscoveredDevice } from '@baishou/core-mobile'
import { getLanDeviceDedupKey } from '@baishou/shared'
import { useNativeTheme } from '@baishou/ui/native'
import { sharedTokens } from '@baishou/ui/theme/tokens'
import { styles, CORE_SIZE } from './LanTransferRadarView.styles'
import { LanTransferBubble } from './LanTransferBubble'

type ThemeColors = ReturnType<typeof useNativeTheme>['colors']

/** 固定三圈雷达基准半径（逻辑像素） */
const RING_RADII = [100, 200, 300] as const

const PULSE_DURATION_MS = 2400

export interface LanTransferRadarViewProps {
  devices: DiscoveredDevice[]
  isDiscovering: boolean
  sendingTo: string | null
  sendProgress: number
  onDevicePress: (device: DiscoveredDevice) => void
  localIp?: string | null
  localPort?: number | null
}

/** 动态向外扩散的雷达波纹 */
const RadarRipples: React.FC<{
  center: { x: number; y: number }
  colors: ThemeColors
  isActive: boolean
}> = ({ center, colors, isActive }) => {
  const anim1 = useRef(new Animated.Value(0)).current
  const anim2 = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (!isActive) return

    const createRipple = (val: Animated.Value) =>
      Animated.loop(
        Animated.timing(val, {
          toValue: 1,
          duration: 3200,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true
        })
      )

    const loop1 = createRipple(anim1)
    let loop2: Animated.CompositeAnimation | null = null

    loop1.start()
    const timer = setTimeout(() => {
      loop2 = createRipple(anim2)
      loop2.start()
    }, 1600)

    return () => {
      loop1.stop()
      if (loop2) loop2.stop()
      clearTimeout(timer)
      anim1.setValue(0)
      anim2.setValue(0)
    }
  }, [isActive, anim1, anim2])

  if (!isActive) return null

  const baseSize = 80

  const renderWave = (val: Animated.Value, key: string) => {
    const scale = val.interpolate({
      inputRange: [0, 1],
      outputRange: [0.7, 3.4]
    })
    const opacity = val.interpolate({
      inputRange: [0, 0.2, 0.75, 1],
      outputRange: [0, 0.32, 0.12, 0]
    })

    return (
      <Animated.View
        key={key}
        style={[
          styles.rippleWave,
          {
            left: center.x - baseSize / 2,
            top: center.y - baseSize / 2,
            width: baseSize,
            height: baseSize,
            borderRadius: baseSize / 2,
            borderColor: colors.primary,
            opacity,
            transform: [{ scale }]
          }
        ]}
      />
    )
  }

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {renderWave(anim1, 'wave-1')}
      {renderWave(anim2, 'wave-2')}
    </View>
  )
}

/** 雷达十字准星与外环刻度 */
const RadarReticle: React.FC<{
  center: { x: number; y: number }
  radius: number
  colors: ThemeColors
}> = ({ center, radius, colors }) => {
  const lineSpan = radius * 2
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View
        style={[
          styles.reticleLineH,
          {
            left: center.x - radius,
            top: center.y,
            width: lineSpan,
            backgroundColor: colors.borderSubtle
          }
        ]}
      />
      <View
        style={[
          styles.reticleLineV,
          {
            left: center.x,
            top: center.y - radius,
            height: lineSpan,
            backgroundColor: colors.borderSubtle
          }
        ]}
      />
      <View
        style={[
          styles.reticleTick,
          { left: center.x - 2, top: center.y - radius - 2, backgroundColor: colors.borderMuted }
        ]}
      />
      <View
        style={[
          styles.reticleTick,
          { left: center.x - 2, top: center.y + radius - 2, backgroundColor: colors.borderMuted }
        ]}
      />
      <View
        style={[
          styles.reticleTick,
          { left: center.x - radius - 2, top: center.y - 2, backgroundColor: colors.borderMuted }
        ]}
      />
      <View
        style={[
          styles.reticleTick,
          { left: center.x + radius - 2, top: center.y - 2, backgroundColor: colors.borderMuted }
        ]}
      />
    </View>
  )
}

const PulseCore: React.FC<{ colors: ThemeColors; isDiscovering: boolean }> = ({
  colors,
  isDiscovering
}) => {
  const pulse = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (!isDiscovering) return
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
  }, [pulse, isDiscovering])

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.1] })

  return (
    <Animated.View
      style={[
        styles.pulseCore,
        {
          backgroundColor: colors.primary,
          transform: [{ scale }],
          ...Platform.select({
            ios: {
              shadowColor: colors.primary,
              shadowOpacity: 0.35,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 2 }
            },
            android: {
              elevation: 4
            },
            default: {}
          })
        }
      ]}
    >
      <Radar size={24} color={colors.textOnPrimary} strokeWidth={2.2} />
    </Animated.View>
  )
}

export const LanTransferRadarView: React.FC<LanTransferRadarViewProps> = ({
  devices,
  isDiscovering,
  sendingTo,
  sendProgress,
  onDevicePress,
  localIp,
  localPort
}) => {
  const { t } = useTranslation()
  const { colors, isDark } = useNativeTheme()
  const { width: windowWidth, height: windowHeight } = useWindowDimensions()
  const insets = useSafeAreaInsets()

  const containerRef = useRef<View>(null)
  const [zone, setZone] = useState<LayoutRectangle | null>(null)
  const [containerPageY, setContainerPageY] = useState<number | null>(null)

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    const layout = e.nativeEvent.layout
    setZone(layout)
    containerRef.current?.measureInWindow((_x, pageY) => {
      if (typeof pageY === 'number' && !Number.isNaN(pageY) && pageY > 0) {
        setContainerPageY(pageY)
      }
    })
  }, [])

  // 手机整屏中心点在容器局部坐标系中的 Y 坐标
  const screenCenterY = windowHeight / 2
  const topOffset =
    containerPageY ?? (zone != null ? Math.max(0, windowHeight - zone.height) : insets.top + 48)
  const screenCenterInZoneY = screenCenterY - topOffset

  const cx = zone != null ? zone.width / 2 : windowWidth / 2
  const cy =
    zone != null
      ? Math.round(Math.max(120, Math.min(zone.height - 130, screenCenterInZoneY)))
      : Math.round(screenCenterInZoneY)

  const center = { x: cx, y: cy }
  const scale = zone != null ? Math.min(zone.width, zone.height) / (RING_RADII[2] * 2 + 50) : 1
  const maxRadius = RING_RADII[2] * scale

  return (
    <View
      ref={containerRef}
      style={[styles.root, { backgroundColor: colors.bgApp }]}
      onLayout={handleLayout}
    >
      {zone != null && (
        <>
          <RadarReticle center={center} radius={maxRadius} colors={colors} />
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            {RING_RADII.map((r, index) => {
              const diameter = r * 2 * scale
              const isMiddle = index === 1
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
                      backgroundColor: 'transparent',
                      opacity: index === 0 ? 0.45 : isMiddle ? 0.8 : 0.6,
                      left: cx - diameter / 2,
                      top: cy - diameter / 2
                    }
                  ]}
                />
              )
            })}
          </View>
        </>
      )}

      <RadarRipples center={center} colors={colors} isActive={isDiscovering} />

      <View
        style={[
          styles.coreWrap,
          {
            left: cx - CORE_SIZE / 2,
            top: cy - CORE_SIZE / 2,
            width: CORE_SIZE,
            height: CORE_SIZE
          }
        ]}
        pointerEvents="none"
      >
        <PulseCore colors={colors} isDiscovering={isDiscovering} />
      </View>

      {zone != null &&
        devices
          .slice(0, 5)
          .map((device, index) => (
            <LanTransferBubble
              key={getLanDeviceDedupKey(device)}
              device={device}
              index={index}
              zone={zone}
              center={center}
              colors={colors}
              isDark={isDark}
              isSending={sendingTo === getLanDeviceDedupKey(device)}
              sendProgress={sendProgress}
              onPress={() => onDevicePress(device)}
            />
          ))}

      <View
        style={[
          styles.statusCardWrap,
          {
            bottom: Math.max(insets.bottom, sharedTokens.spacing.md) + sharedTokens.spacing.xs
          }
        ]}
        pointerEvents="box-none"
      >
        <View
          style={[
            styles.statusCard,
            {
              backgroundColor: colors.bgSurface,
              borderColor: colors.borderSubtle
            }
          ]}
        >
          <View style={styles.statusHeaderRow}>
            <View
              style={[
                styles.statusIconBox,
                {
                  backgroundColor: colors.primaryLight
                }
              ]}
            >
              {devices.length > 0 ? (
                <Wifi size={17} color={colors.primary} strokeWidth={2.2} />
              ) : (
                <Radar size={17} color={colors.primary} strokeWidth={2.2} />
              )}
            </View>
            <View style={styles.statusTextWrap}>
              <Text style={[styles.statusTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                {devices.length > 0
                  ? t('lan_transfer.devices_found_count', '已发现 {{count}} 台设备', {
                      count: devices.length
                    })
                  : t('lan_transfer.scanning_nearby')}
              </Text>
              <Text
                style={[styles.statusSubtitle, { color: colors.textSecondary }]}
                numberOfLines={2}
              >
                {devices.length > 0
                  ? t('lan_transfer.devices_found_hint', '点击上方设备卡片即可发起备份传输')
                  : t('lan_transfer.scan_hint')}
              </Text>
            </View>
          </View>

          {localIp ? (
            <View style={[styles.localIpRow, { borderTopColor: colors.borderSubtle }]}>
              <Text style={[styles.localIpLabel, { color: colors.textTertiary }]}>
                {t('lan_transfer.local_device_ip', '本机 IP:')}{' '}
                <Text style={[styles.localIpValue, { color: colors.textSecondary }]}>
                  {localIp}
                  {localPort ? `:${localPort}` : ''}
                </Text>
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  )
}
