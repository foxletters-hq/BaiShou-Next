import React, { useState, useEffect, useRef } from 'react'
import styles from './LanSyncCard.module.css'
import { useTranslation } from 'react-i18next'
import { useDialog } from '../Dialog'
import { useToast } from '../Toast/useToast'
import { MdRadar, MdRefresh, MdComputer, MdSmartphone } from 'react-icons/md'
import { HelpTooltip } from '../HelpTooltip'
import { RestoreBlockingOverlay } from '../RestoreBlockingOverlay'
import {
  LAN_DEVICE_STALE_MS,
  formatLanReceivedBackupContent,
  getLanDeviceDedupKey,
  removeDiscoveredLanDevice,
  upsertDiscoveredLanDevice
} from '@baishou/shared'

export interface DiscoveredDevice {
  deviceId: string
  nickname: string
  ip: string
  port: number
  deviceType: 'mobile' | 'desktop' | 'other'
  rawServiceId: string
}

export interface LanSyncCardProps {
  onStartBroadcasting: () => Promise<{
    ip: string
    port: number
    serviceId: string
    deviceId?: string
    allIps?: string[]
  } | null>
  onStopBroadcasting: () => Promise<void>
  onStartDiscovery: (
    onDeviceFound: (device: DiscoveredDevice) => void,
    onDeviceLost: (deviceId: string) => void
  ) => Promise<(() => void) | void>
  onStopDiscovery: () => Promise<void>
  onSendFile: (ip: string, port: number, onProgress: (p: number) => void) => Promise<boolean>
  onDiscoveryResetListener?: (callback: () => void) => () => void
  onFileReceivedListener?: (callback: (zipPath: string, sizeBytes?: number) => void) => () => void
  onImportZip?: (filePath: string) => Promise<void>
}

const FIXED_POSITIONS = [
  { top: '20%', left: '20%' }, // top-left
  { top: '30%', left: '75%' }, // top-right
  { top: '80%', left: '50%' }, // bottom-center
  { top: '75%', left: '25%' }, // bottom-left
  { top: '75%', left: '75%' } // bottom-right
]

export const LanSyncCard: React.FC<LanSyncCardProps> = ({
  onStartBroadcasting,
  onStopBroadcasting,
  onStartDiscovery,
  onStopDiscovery,
  onSendFile,
  onDiscoveryResetListener,
  onFileReceivedListener,
  onImportZip
}) => {
  const { t } = useTranslation()
  const dialog = useDialog()
  const toast = useToast()
  const [isActive, setIsActive] = useState(true) // Start active like Flutter
  const [devices, setDevices] = useState<DiscoveredDevice[]>([])
  const [sendingTo, setSendingTo] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [isRestoring, setIsRestoring] = useState(false)
  const discoveryCleanupRef = useRef<(() => void) | null>(null)
  const deviceSeenAtRef = useRef<Map<string, number>>(new Map())

  const isSelfDevice = (
    dev: DiscoveredDevice,
    connInfo: {
      ip: string
      port: number
      serviceId: string
      deviceId?: string
      allIps?: string[]
    } | null
  ) => {
    if (!connInfo) return false
    if (connInfo.deviceId && dev.deviceId === connInfo.deviceId) return true
    if (dev.rawServiceId === connInfo.serviceId) return true
    if (dev.port !== connInfo.port) return false
    const localIps = connInfo.allIps?.length ? connInfo.allIps : [connInfo.ip]
    return localIps.includes(dev.ip)
  }

  const markDeviceSeen = (device: DiscoveredDevice) => {
    deviceSeenAtRef.current.set(getLanDeviceDedupKey(device), Date.now())
  }

  const startDualMode = async () => {
    setIsActive(true)
    discoveryCleanupRef.current?.()
    discoveryCleanupRef.current = null
    deviceSeenAtRef.current.clear()
    setDevices([])

    const connInfo = await onStartBroadcasting()

    const cleanupParts: Array<(() => void) | void> = []
    if (onDiscoveryResetListener) {
      cleanupParts.push(
        onDiscoveryResetListener(() => {
          deviceSeenAtRef.current.clear()
          setDevices([])
        })
      )
    }

    const cleanup = await onStartDiscovery(
      (dev) => {
        if (isSelfDevice(dev, connInfo)) return
        markDeviceSeen(dev)
        setDevices((prev) => upsertDiscoveredLanDevice(prev, dev))
      },
      (id) => {
        setDevices((prev) => removeDiscoveredLanDevice(prev, id))
      }
    )
    if (typeof cleanup === 'function') {
      cleanupParts.push(cleanup)
    }
    if (cleanupParts.length > 0) {
      discoveryCleanupRef.current = () => {
        for (const part of cleanupParts) {
          part?.()
        }
      }
    }
  }

  const stopDualMode = async () => {
    setIsActive(false)
    setDevices([])
    deviceSeenAtRef.current.clear()
    discoveryCleanupRef.current?.()
    discoveryCleanupRef.current = null
    await onStopDiscovery()
    await onStopBroadcasting()
  }

  const restartDualMode = async () => {
    await stopDualMode()
    setTimeout(() => {
      startDualMode()
    }, 500)
  }

  // Mount/Unmount effect
  useEffect(() => {
    let unmounted = false
    const init = async () => {
      // 延迟加载，确保界面挂载后再启动雷达底层绑定，防止快速进出界面的端口占用竞争
      await new Promise((r) => setTimeout(r, 400))
      if (unmounted) return
      await startDualMode()
    }
    init()

    return () => {
      unmounted = true
      stopDualMode()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (onFileReceivedListener && onImportZip) {
      const unsub = onFileReceivedListener(async (zipPath, sizeBytes = 0) => {
        const confirmed = await dialog.confirm(
          formatLanReceivedBackupContent(t('lan_transfer.received_backup_content'), sizeBytes),
          t('lan_transfer.received_backup_title', '收到数据备份')
        )
        if (confirmed) {
          setIsRestoring(true)
          let willReload = false
          onImportZip(zipPath)
            .then(() => {
              toast.showSuccess(t('lan.import_success', '导入成功，应用即将重载'))
              willReload = true
              setTimeout(() => window.location.reload(), 1500)
            })
            .catch((e) => {
              console.error(e)
              toast.showError(t('lan.import_failed', '重载导入失败'))
            })
            .finally(() => {
              if (!willReload) setIsRestoring(false)
            })
        } else {
          toast.show(t('lan.receive_cancelled', '已取消接收与挂载'))
        }
      })
      return unsub
    }
    return undefined
  }, [onFileReceivedListener, onImportZip, dialog, t, toast])

  useEffect(() => {
    if (!isActive) return

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
  }, [isActive])

  const handleSend = async (device: DiscoveredDevice) => {
    const deviceKey = getLanDeviceDedupKey(device)
    markDeviceSeen(device)
    setSendingTo(deviceKey)
    setProgress(0)
    const success = await onSendFile(device.ip, device.port, (p) => setProgress(p))
    setSendingTo(null)
    if (success) {
      toast.showSuccess(
        t('lan.send_success', '已成功发送至 {{name}}', {
          name: device.nickname
        })
      )
    } else {
      toast.showError(
        t('lan.send_failed', '发送至 {{name}} 失败，对端离线或超时。', {
          name: device.nickname
        })
      )
    }
  }

  return (
    <>
      <RestoreBlockingOverlay visible={isRestoring} />
      <div className={styles.container}>
        <div className={styles.appBar}>
          <div style={{ flex: 1 }} />
          <HelpTooltip
            content={t(
              'lan_transfer.usage_tooltip',
              '在同一局域网（Wi-Fi）下，两台设备都打开此页面，即可相互快速传输整个数据的全量备份包。'
            )}
            size={20}
            className={styles.helpBtn}
          />
          <button
            className={styles.refreshBtn}
            onClick={restartDualMode}
            title={t('common.refresh', '刷新')}
          >
            <MdRefresh size={20} />
          </button>
        </div>

        <div className={styles.radarZone}>
          {isActive && (
            <div className={styles.radarRings}>
              <div className={`${styles.ring} ${styles.ring1}`}></div>
              <div className={`${styles.ring} ${styles.ring2}`}></div>
              <div className={`${styles.ring} ${styles.ring3}`}></div>
            </div>
          )}

          <div className={`${styles.radarCore} ${isActive ? styles.corePulse : ''}`}>
            <span className={styles.coreIcon}>
              <MdRadar size={32} />
            </span>
          </div>

          {isActive && devices.length === 0 && (
            <div className={styles.scanHintWrapper}>
              <div className={styles.scanTitle}>
                {t('lan_transfer.scanning_nearby', '正在扫描附近设备...')}
              </div>
              <div className={styles.scanSubtitle}>
                {t('lan_transfer.scan_hint', '请确保两台设备处于相同的 Wi-Fi 网络下')}
              </div>
            </div>
          )}

          {isActive &&
            devices.map((d, index) => {
              const pos = FIXED_POSITIONS[index % FIXED_POSITIONS.length]
              const deviceKey = getLanDeviceDedupKey(d)
              const isSending = sendingTo === deviceKey
              const delayStyle = { animationDelay: `${index * 0.5}s` }

              return (
                <div
                  key={deviceKey}
                  className={`${styles.deviceBubble} ${isSending ? styles.bubbleSending : ''}`}
                  style={{ top: pos.top, left: pos.left, ...delayStyle }}
                >
                  <div className={styles.bubbleIcon}>
                    {d.deviceType === 'mobile' ? (
                      <MdSmartphone size={20} />
                    ) : (
                      <MdComputer size={20} />
                    )}
                  </div>
                  <div className={styles.bubbleInfo}>
                    <span className={styles.bubbleName} title={d.nickname}>
                      {d.nickname}
                    </span>
                    <span className={styles.bubbleIp}>{d.ip}</span>
                  </div>

                  <button
                    className={styles.sendOverlayBtn}
                    disabled={sendingTo !== null}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleSend(d)
                    }}
                  >
                    {isSending ? `${progress}%` : t('common.export', '发送')}
                  </button>
                </div>
              )
            })}
        </div>
      </div>
    </>
  )
}
