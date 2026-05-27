import { useEffect, useCallback, useState } from 'react'
import type { DiscoveredDevice, LanSyncCardProps } from './lan-sync-card.types'

export function useLanSyncCard({
  onStartBroadcasting,
  onStopBroadcasting,
  onStartDiscovery,
  onStopDiscovery,
  onSendFile,
  discoveredDevices = [],
  isActive = false
}: Pick<
  LanSyncCardProps,
  | 'onStartBroadcasting'
  | 'onStopBroadcasting'
  | 'onStartDiscovery'
  | 'onStopDiscovery'
  | 'onSendFile'
  | 'discoveredDevices'
  | 'isActive'
>) {
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

  return {
    devices,
    sendProgress,
    sendingDevice,
    handleToggleSync,
    handleSend
  }
}
