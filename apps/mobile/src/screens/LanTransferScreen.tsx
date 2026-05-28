import React, { useState, useCallback, useEffect, useRef } from 'react'
import { StyleSheet, Alert } from 'react-native'
import { useNativeTheme } from '@baishou/ui/native'
import { useBaishou } from '../providers/BaishouProvider'
import { useTranslation } from 'react-i18next'
import type { DiscoveredDevice } from '@baishou/core-mobile'
import { LanTransferRadarView } from '../components/LanTransferRadarView'
import { StackScreenLayout } from '../components/StackScreenLayout'
import { getStackScreenChrome } from '../components/stackScreenChrome'

export const LanTransferScreen: React.FC = () => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const { services, dbReady } = useBaishou()

  const [devices, setDevices] = useState<DiscoveredDevice[]>([])
  const [isDiscovering, setIsDiscovering] = useState(false)
  const [sendingTo, setSendingTo] = useState<string | null>(null)
  const [sendProgress, setSendProgress] = useState(0)
  const localConnRef = useRef<{ ip: string; port: number; serviceId: string } | null>(null)

  const lanSyncService = services?.lanSyncService
  const archiveService = services?.archiveService

  const isSelfDevice = useCallback((dev: DiscoveredDevice) => {
    const conn = localConnRef.current
    if (!conn) return false
    return dev.rawServiceId === conn.serviceId || (dev.port === conn.port && dev.ip === conn.ip)
  }, [])

  const stopDualMode = useCallback(async () => {
    setIsDiscovering(false)
    setDevices([])
    localConnRef.current = null
    await lanSyncService?.stopDiscovery().catch(() => {})
    await lanSyncService?.stopBroadcasting().catch(() => {})
  }, [lanSyncService])

  const startDualMode = useCallback(async () => {
    if (!dbReady || !lanSyncService) return
    setIsDiscovering(true)
    setDevices([])

    const conn = await lanSyncService.startBroadcasting()
    if (conn) localConnRef.current = conn

    await lanSyncService.startDiscovery(
      (device) => {
        if (isSelfDevice(device)) return
        setDevices((prev) => {
          const idx = prev.findIndex((d) => d.rawServiceId === device.rawServiceId)
          if (idx >= 0) {
            const next = [...prev]
            next[idx] = device
            return next
          }
          return [...prev, device]
        })
      },
      (id) => setDevices((prev) => prev.filter((d) => d.rawServiceId !== id))
    )

    lanSyncService.onFileReceived((zipPath) => {
      Alert.alert(t('lan_transfer.received_backup_title'), t('lan_transfer.received_backup_content'), [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.restore'),
          onPress: async () => {
            if (!archiveService) return
            try {
              await archiveService.importFromZip(zipPath, true)
              Alert.alert(t('common.success'), t('lan.import_success'))
            } catch (e: unknown) {
              const msg = e instanceof Error ? e.message : String(e)
              Alert.alert(t('common.error'), msg || t('lan.import_failed'))
            }
          }
        }
      ])
    })
  }, [archiveService, dbReady, isSelfDevice, lanSyncService, t])

  const restartDualMode = useCallback(async () => {
    await stopDualMode()
    setTimeout(() => void startDualMode(), 400)
  }, [startDualMode, stopDualMode])

  useEffect(() => {
    if (!dbReady || !lanSyncService) return
    const timer = setTimeout(() => void startDualMode(), 400)
    return () => {
      clearTimeout(timer)
      void stopDualMode()
    }
  }, [dbReady, lanSyncService, startDualMode, stopDualMode])

  const sendToDevice = useCallback(
    async (device: DiscoveredDevice) => {
      if (!lanSyncService || sendingTo) return
      setSendingTo(device.rawServiceId)
      setSendProgress(0)
      const ok = await lanSyncService.sendFile(device.ip, device.port, (p) => setSendProgress(p))
      setSendingTo(null)
      Alert.alert(
        ok ? t('common.success') : t('common.error'),
        ok
          ? t('lan.send_success', { name: device.nickname })
          : t('lan.send_failed', { name: device.nickname })
      )
    },
    [lanSyncService, sendingTo, t]
  )

  const handleDevicePress = useCallback(
    (device: DiscoveredDevice) => {
      if (sendingTo || !device.ip || device.ip === 'Unknown') {
        if (device.ip === 'Unknown') {
          Alert.alert(t('common.error'), t('lan_transfer.ip_not_found'))
        }
        return
      }
      Alert.alert(
        t('lan_transfer.send_confirm_title').replace('$nickname', device.nickname),
        t('lan_transfer.send_confirm_content'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('common.export'),
            onPress: () => {
              void sendToDevice(device)
            }
          }
        ]
      )
    },
    [sendToDevice, sendingTo, t]
  )

  return (
    <StackScreenLayout
      title={t('lan_transfer.title')}
      {...getStackScreenChrome(colors)}
      headerRight={{
        icon: 'refresh',
        onPress: () => void restartDualMode(),
        accessibilityLabel: t('common.refresh')
      }}
      contentStyle={styles.content}
    >
      <LanTransferRadarView
        devices={devices}
        isDiscovering={isDiscovering}
        sendingTo={sendingTo}
        sendProgress={sendProgress}
        onDevicePress={handleDevicePress}
      />
    </StackScreenLayout>
  )
}

const styles = StyleSheet.create({
  content: { flex: 1 }
})
