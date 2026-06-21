import React, { useState, useCallback, useEffect, useRef } from 'react'
import { StyleSheet } from 'react-native'
import {
  useNativeTheme,
  useNativeToast,
  useDialog,
  RestoreBlockingOverlay
} from '@baishou/ui/native'
import { useBaishou } from '../providers/BaishouProvider'
import { useTranslation } from 'react-i18next'
import type { DiscoveredDevice } from '@baishou/core-mobile'
import {
  LAN_DEVICE_STALE_MS,
  formatLanReceivedBackupContent,
  getLanDeviceDedupKey,
  removeDiscoveredLanDevice,
  upsertDiscoveredLanDevice
} from '@baishou/shared'
import { LanTransferRadarView } from '../components/LanTransferRadarView'
import { StackScreenLayout } from '../components/StackScreenLayout'
import { getStackScreenChrome } from '../components/stackScreenChrome'
import { applyArchiveImportFeedback } from '../utils/archive-restore-feedback'
import {
  buildArchiveImportProgress,
  reportArchiveImportStage,
  resolveArchiveImportStageDetail,
  resolveArchiveImportStageHint,
  resolveArchiveImportStageMessage,
  type ArchiveImportProgress
} from '../services/archive-guards.util'

export const LanTransferScreen: React.FC = () => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const toast = useNativeToast()
  const dialog = useDialog()
  const { services, dbReady, notifyArchiveRestoreComplete } = useBaishou()

  const [devices, setDevices] = useState<DiscoveredDevice[]>([])
  const [isDiscovering, setIsDiscovering] = useState(false)
  const [sendingTo, setSendingTo] = useState<string | null>(null)
  const [sendProgress, setSendProgress] = useState(0)
  const [isRestoring, setIsRestoring] = useState(false)
  const [importProgress, setImportProgress] = useState<ArchiveImportProgress | null>(null)
  const [isReceiving, setIsReceiving] = useState(false)
  const [receiveProgress, setReceiveProgress] = useState(0)
  const localConnRef = useRef<{
    ip: string
    port: number
    serviceId: string
    deviceId?: string
  } | null>(null)
  const deviceSeenAtRef = useRef<Map<string, number>>(new Map())

  const lanSyncService = services?.lanSyncService
  const archiveService = services?.archiveService

  const isSelfDevice = useCallback((dev: DiscoveredDevice) => {
    const conn = localConnRef.current
    if (!conn) return false
    if (conn.deviceId && dev.deviceId === conn.deviceId) return true
    return dev.rawServiceId === conn.serviceId || (dev.port === conn.port && dev.ip === conn.ip)
  }, [])

  const markDeviceSeen = useCallback((device: DiscoveredDevice) => {
    deviceSeenAtRef.current.set(getLanDeviceDedupKey(device), Date.now())
  }, [])

  const stopDualMode = useCallback(async () => {
    setIsDiscovering(false)
    setDevices([])
    deviceSeenAtRef.current.clear()
    localConnRef.current = null
    await lanSyncService?.stopDiscovery().catch(() => {})
    await lanSyncService?.stopBroadcasting().catch(() => {})
  }, [lanSyncService])

  const startDualMode = useCallback(async () => {
    if (!dbReady || !lanSyncService) return
    setIsDiscovering(true)
    setDevices([])
    deviceSeenAtRef.current.clear()

    try {
      const conn = await lanSyncService.startBroadcasting()
      if (conn) localConnRef.current = conn

      await lanSyncService.startDiscovery(
        (device) => {
          if (isSelfDevice(device)) return
          markDeviceSeen(device)
          setDevices((prev) => upsertDiscoveredLanDevice(prev, device))
        },
        (id) => setDevices((prev) => removeDiscoveredLanDevice(prev, id))
      )

      lanSyncService.onLanUploadStarted(() => {
        setIsReceiving(true)
        setReceiveProgress(0)
      })
      lanSyncService.onLanUploadProgress((written, total) => {
        if (total > 0) {
          setReceiveProgress(Math.min(99, Math.round((written / total) * 100)))
        }
      })

      lanSyncService.onFileReceived((zipPath) => {
        void (async () => {
          setReceiveProgress(100)
          let sizeBytes = 0
          try {
            const stat = await services?.fileSystem.stat(zipPath)
            sizeBytes = stat.size ?? 0
          } catch {
            // ignore
          }
          const restore = await dialog.confirm(
            formatLanReceivedBackupContent(t('lan_transfer.received_backup_content'), sizeBytes),
            {
              title: t('lan_transfer.received_backup_title'),
              confirmText: t('common.restore')
            }
          )
          if (!restore || !archiveService) {
            setIsReceiving(false)
            return
          }
          setIsReceiving(false)
          setIsRestoring(true)
          setImportProgress(buildArchiveImportProgress('preparing'))
          try {
            const result = await archiveService.importFromZip(zipPath, true, (progress) =>
              setImportProgress(progress)
            )
            reportArchiveImportStage(setImportProgress, 'succeeded', { percent: 100 })
            applyArchiveImportFeedback(result, t, toast, notifyArchiveRestoreComplete)
            await new Promise((resolve) => setTimeout(resolve, 900))
          } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e)
            setImportProgress(buildArchiveImportProgress('failed', { percent: 100, detail: msg }))
            toast.showError(msg || t('lan.import_failed'))
            await new Promise((resolve) => setTimeout(resolve, 900))
          } finally {
            setIsRestoring(false)
            setImportProgress(null)
            setIsReceiving(false)
          }
        })()
      })
    } catch (e: unknown) {
      setIsDiscovering(false)
      const msg = e instanceof Error ? e.message : String(e)
      toast.showError(msg || t('lan_transfer.scan_failed', '局域网扫描启动失败'))
    }
  }, [
    archiveService,
    dbReady,
    dialog,
    isSelfDevice,
    lanSyncService,
    markDeviceSeen,
    notifyArchiveRestoreComplete,
    services,
    t,
    toast
  ])

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

  useEffect(() => {
    if (!isDiscovering) return

    const timer = setInterval(() => {
      const now = Date.now()
      setDevices((prev) =>
        prev.filter((device) => {
          const seenAt = deviceSeenAtRef.current.get(getLanDeviceDedupKey(device))
          return seenAt != null && now - seenAt < LAN_DEVICE_STALE_MS
        })
      )
    }, 10_000)

    return () => clearInterval(timer)
  }, [isDiscovering])

  const sendToDevice = useCallback(
    async (device: DiscoveredDevice) => {
      if (!lanSyncService || sendingTo) return
      const deviceKey = getLanDeviceDedupKey(device)
      setSendingTo(deviceKey)
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
      <RestoreBlockingOverlay
        visible={isRestoring || isReceiving}
        message={
          isReceiving
            ? t('lan_transfer.receiving_backup', '正在接收备份包（$percent%）…').replace(
                '$percent',
                String(receiveProgress)
              )
            : importProgress
              ? resolveArchiveImportStageMessage(importProgress)
              : undefined
        }
        hint={
          isReceiving
            ? t(
                'lan_transfer.receiving_backup_hint',
                '大包传输需要一些时间，请保持本页面在前台直至完成。'
              )
            : importProgress
              ? resolveArchiveImportStageHint(importProgress)
              : undefined
        }
        detail={importProgress ? resolveArchiveImportStageDetail(importProgress) : undefined}
        progress={importProgress?.percent}
        succeeded={importProgress?.stage === 'succeeded'}
      />
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
