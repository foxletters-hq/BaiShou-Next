import React, { useEffect, useCallback, useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator
} from 'react-native'
import { useNativeTheme } from '../theme'

export interface DiscoveredDevice {
  nickname: string
  ip: string
  port: number
  deviceType: string
  rawServiceId: string
}

export interface LanSyncCardProps {
  onStartBroadcasting: () => Promise<{ ip: string; port: number } | null>
  onStopBroadcasting: () => Promise<void>
  onStartDiscovery: (
    onFound: (d: DiscoveredDevice) => void,
    onLost: (id: string) => void
  ) => Promise<void>
  onStopDiscovery: () => Promise<void>
  onSendFile: (
    ip: string,
    port: number,
    onProgress: (p: number) => void
  ) => Promise<boolean>
  discoveredDevices?: DiscoveredDevice[]
  localConnection?: { ip: string; port: number } | null
  isActive?: boolean
}

export const LanSyncCard: React.FC<LanSyncCardProps> = ({
  onStartBroadcasting,
  onStopBroadcasting,
  onStartDiscovery,
  onStopDiscovery,
  onSendFile,
  discoveredDevices = [],
  localConnection,
  isActive = false
}) => {
  const { colors, tokens } = useNativeTheme()
  const [devices, setDevices] = useState<DiscoveredDevice[]>(discoveredDevices)
  const [sendProgress, setSendProgress] = useState<Record<string, number>>({})
  const [sendingDevice, setSendingDevice] = useState<string | null>(null)

  useEffect(() => {
    setDevices(discoveredDevices)
  }, [discoveredDevices])

  const handleToggleSync = useCallback(async () => {
    if (isActive) {
      await onStopBroadcasting()
      await onStopDiscovery()
    } else {
      await onStartBroadcasting()
      await onStartDiscovery(
        (d) => {
          setDevices((prev) => {
            if (prev.some((existing) => existing.rawServiceId === d.rawServiceId)) {
              return prev
            }
            return [...prev, d]
          })
        },
        (id) => {
          setDevices((prev) => prev.filter((d) => d.rawServiceId !== id))
        }
      )
    }
  }, [isActive, onStartBroadcasting, onStopBroadcasting, onStartDiscovery, onStopDiscovery])

  const handleSend = useCallback(
    async (device: DiscoveredDevice) => {
      setSendingDevice(device.rawServiceId)
      setSendProgress((prev) => ({ ...prev, [device.rawServiceId]: 0 }))
      await onSendFile(device.ip, device.port, (p) => {
        setSendProgress((prev) => ({ ...prev, [device.rawServiceId]: p }))
      })
      setSendingDevice(null)
    },
    [onSendFile]
  )

  const renderDevice = ({ item }: { item: DiscoveredDevice }) => {
    const progress = sendProgress[item.rawServiceId] ?? 0
    const isSending = sendingDevice === item.rawServiceId

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
          <Text style={[styles.deviceName, { color: colors.textPrimary }]}>
            {item.nickname}
          </Text>
          <Text style={[styles.deviceDetail, { color: colors.textTertiary }]}>
            {item.ip}:{item.port} · {item.deviceType}
          </Text>
        </View>
        <TouchableOpacity
          style={[
            styles.sendButton,
            { backgroundColor: colors.primary, borderRadius: tokens.radius.sm }
          ]}
          onPress={() => handleSend(item)}
          disabled={isSending}
          activeOpacity={0.7}
        >
          {isSending ? (
            <ActivityIndicator size="small" color={colors.textOnPrimary} />
          ) : (
            <Text style={[styles.sendButtonText, { color: colors.textOnPrimary }]}>
              发送
            </Text>
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
                    width: `${Math.round(progress * 100)}%` as any,
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

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.bgSurface,
          borderColor: colors.borderSubtle,
          borderRadius: tokens.radius.md
        }
      ]}
    >
      <View style={styles.statusRow}>
        <View style={styles.statusLeft}>
          <View
            style={[
              styles.statusDot,
              {
                backgroundColor: isActive ? colors.success : colors.error
              }
            ]}
          />
          <Text style={[styles.statusText, { color: colors.textPrimary }]}>
            {isActive ? '局域网同步已激活' : '局域网同步未激活'}
          </Text>
        </View>
        <TouchableOpacity
          style={[
            styles.toggleButton,
            {
              backgroundColor: isActive ? colors.error : colors.success,
              borderRadius: tokens.radius.sm
            }
          ]}
          onPress={handleToggleSync}
          activeOpacity={0.7}
        >
          <Text style={[styles.toggleText, { color: colors.textOnPrimary }]}>
            {isActive ? '停止' : '启动'}
          </Text>
        </TouchableOpacity>
      </View>

      {localConnection && (
        <View
          style={[
            styles.qrSection,
            {
              backgroundColor: colors.bgSurfaceNormal,
              borderColor: colors.borderSubtle,
              borderRadius: tokens.radius.sm
            }
          ]}
        >
          <Text style={[styles.qrLabel, { color: colors.textSecondary }]}>
            本机连接信息
          </Text>
          <Text style={[styles.qrText, { color: colors.textPrimary }]}>
            {localConnection.ip}:{localConnection.port}
          </Text>
        </View>
      )}

      {isActive && (
        <View style={styles.devicesSection}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
            发现的设备 ({devices.length})
          </Text>
          {devices.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.textTertiary }]}>
              正在搜索局域网设备...
            </Text>
          ) : (
            <FlatList
              data={devices}
              keyExtractor={(item) => item.rawServiceId}
              renderItem={renderDevice}
              scrollEnabled={false}
            />
          )}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    borderWidth: 1
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16
  },
  statusLeft: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8
  },
  statusText: {
    fontSize: 15,
    fontWeight: '500'
  },
  toggleButton: {
    paddingVertical: 8,
    paddingHorizontal: 20
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '600'
  },
  qrSection: {
    padding: 14,
    borderWidth: 1,
    marginBottom: 16,
    alignItems: 'center'
  },
  qrLabel: {
    fontSize: 12,
    marginBottom: 6
  },
  qrText: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'monospace'
  },
  devicesSection: {
    marginTop: 4
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 10
  },
  emptyText: {
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 16
  },
  deviceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    marginBottom: 8,
    flexWrap: 'wrap'
  },
  deviceInfo: {
    flex: 1,
    marginRight: 8
  },
  deviceName: {
    fontSize: 14,
    fontWeight: '500'
  },
  deviceDetail: {
    fontSize: 12,
    marginTop: 2
  },
  sendButton: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center'
  },
  sendButtonText: {
    fontSize: 13,
    fontWeight: '600'
  },
  progressMini: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    width: '100%'
  },
  progressMiniBar: {
    flex: 1,
    height: 4,
    marginRight: 8,
    overflow: 'hidden'
  },
  progressMiniFill: {
    height: 4
  },
  progressMiniText: {
    fontSize: 11,
    width: 36,
    textAlign: 'right'
  }
})
