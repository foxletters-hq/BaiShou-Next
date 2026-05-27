import React from 'react'
import { View, Text, TouchableOpacity, FlatList } from 'react-native'
import { useNativeTheme } from '../theme'
import type { LanSyncCardProps } from './lan-sync-card.types'
import { lanSyncCardStyles as styles } from './lan-sync-card.styles'
import { useLanSyncCard } from './useLanSyncCard'
import { LanSyncDeviceRow } from './LanSyncDeviceRow'

export type { DiscoveredDevice, LanSyncCardProps } from './lan-sync-card.types'

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
  const { devices, sendProgress, sendingDevice, handleToggleSync, handleSend } = useLanSyncCard({
    onStartBroadcasting,
    onStopBroadcasting,
    onStartDiscovery,
    onStopDiscovery,
    onSendFile,
    discoveredDevices,
    isActive
  })

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
          <Text style={[styles.qrLabel, { color: colors.textSecondary }]}>本机连接信息</Text>
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
              renderItem={({ item }) => (
                <LanSyncDeviceRow
                  item={item}
                  progress={sendProgress[item.rawServiceId] ?? 0}
                  isSending={sendingDevice === item.rawServiceId}
                  onSend={handleSend}
                  colors={colors}
                  tokens={tokens}
                />
              )}
              scrollEnabled={false}
            />
          )}
        </View>
      )}
    </View>
  )
}
