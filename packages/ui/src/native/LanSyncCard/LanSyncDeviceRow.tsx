import React from 'react'
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native'
import type { useNativeTheme } from '../theme'
import type { DiscoveredDevice } from './lan-sync-card.types'
import { lanSyncCardStyles as styles } from './lan-sync-card.styles'

export function LanSyncDeviceRow({
  item,
  progress,
  isSending,
  onSend,
  colors,
  tokens
}: {
  item: DiscoveredDevice
  progress: number
  isSending: boolean
  onSend: (device: DiscoveredDevice) => void
  colors: ReturnType<typeof useNativeTheme>['colors']
  tokens: ReturnType<typeof useNativeTheme>['tokens']
}) {
  return (
    <View
      style={[
        styles.deviceItem,
        {
          backgroundColor: colors.bgSurfaceNormal,
          borderColor: colors.borderSubtle,
          borderRadius: tokens.radius.sm
        }
      ]}
    >
      <View style={styles.deviceInfo}>
        <Text style={[styles.deviceName, { color: colors.textPrimary }]}>{item.nickname}</Text>
        <Text style={[styles.deviceDetail, { color: colors.textTertiary }]}>
          {item.ip}:{item.port} · {item.deviceType}
        </Text>
      </View>
      <TouchableOpacity
        style={[
          styles.sendButton,
          { backgroundColor: colors.primary, borderRadius: tokens.radius.sm }
        ]}
        onPress={() => onSend(item)}
        disabled={isSending}
        activeOpacity={0.7}
      >
        {isSending ? (
          <ActivityIndicator size="small" color={colors.textOnPrimary} />
        ) : (
          <Text style={[styles.sendButtonText, { color: colors.textOnPrimary }]}>发送</Text>
        )}
      </TouchableOpacity>
      {isSending && progress > 0 && (
        <View style={styles.progressMini}>
          <View
            style={[
              styles.progressMiniBar,
              {
                backgroundColor: colors.bgSurfaceNormal,
                borderRadius: 2
              }
            ]}
          >
            <View
              style={[
                styles.progressMiniFill,
                {
                  backgroundColor: colors.primary,
                  width: `${Math.round(progress * 100)}%` as `${number}%`,
                  borderRadius: 2
                }
              ]}
            />
          </View>
          <Text style={[styles.progressMiniText, { color: colors.textTertiary }]}>
            {Math.round(progress * 100)}%
          </Text>
        </View>
      )}
    </View>
  )
}
