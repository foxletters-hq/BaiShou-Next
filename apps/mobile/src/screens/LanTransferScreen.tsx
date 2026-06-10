import React, { useState, useCallback, useEffect, useRef } from 'react'
import { StyleSheet } from 'react-native'
import { useNativeTheme, useNativeToast, useDialog, RestoreBlockingOverlay } from '@baishou/ui/native'
import { useBaishou } from '../providers/BaishouProvider'
import { useTranslation } from 'react-i18next'
import type { DiscoveredDevice } from '@baishou/core-mobile'
import { LanTransferRadarView } from '../components/LanTransferRadarView'
import { StackScreenLayout } from '../components/StackScreenLayout'
import { getStackScreenChrome } from '../components/stackScreenChrome'

export const LanTransferScreen: React.FC = () => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const toast = useNativeToast()
  const dialog = useDialog()
  const { services, dbReady } = useBaishou()

  const [devices, setDevices] = useState<DiscoveredDevice[]>([])
  const [isDiscovering, setIsDiscovering] = useState(false)
  const [sendingTo, setSendingTo] = useState<string | null>(null)
  const [sendProgress, setSendProgress] = useState(0)
  const [isRestoring, setIsRestoring] = useState(false)
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
      void (async () => {
        const restore = await dialog.confirm(t('lan_transfer.received_backup_content'), {
          title: t('lan_transfer.received_backup_title'),
          confirmText: t('common.restore')
        })
        if (!restore || !archiveService) return
        setIsRestoring(true)
        try {
          await archiveService.importFromZip(zipPath, true)
          toast.showSuccess(t('lan.import_success'))
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e)
          toast.showError(msg || t('lan.import_failed'))
        } finally {
          setIsRestoring(false)
        }
      })()
    })
  }, [archiveService, dbReady, dialog, isSelfDevice, lanSyncService, t, toast])

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
      if (ok) {
        toast.showSuccess(t('lan.send_success', { name: device.nickname }))
      } else {
        toast.showError(t('lan.send_failed', { name: device.nickname }))
      }
    },
    [lanSyncService, sendingTo, t, toast]
  )

  const handleDevicePress = useCallback(
    (device: DiscoveredDevice) => {
      if (sendingTo || !device.ip || device.ip === 'Unknown') {
        if (device.ip === 'Unknown') {
          toast.showError(t('lan_transfer.ip_not_found'))
        }
        return
      }
      void (async () => {
        const confirmed = await dialog.confirm(t('lan_transfer.send_confirm_content'), {
          title: t('lan_transfer.send_confirm_title').replace('$nickname', device.nickname),
          confirmText: t('common.export')
        })
        if (confirmed) void sendToDevice(device)
      })()
    },
    [dialog, sendToDevice, sendingTo, t, toast]
  )

  return (
    <>
    <RestoreBlockingOverlay visible={isRestoring} />
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
    </>
  )
}

const styles = StyleSheet.create({
  content: { flex: 1 }
})
