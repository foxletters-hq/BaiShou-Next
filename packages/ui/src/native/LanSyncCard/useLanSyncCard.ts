import { useEffect, useCallback, useState } from 'react'
import {
  getLanDeviceDedupKey,
  removeDiscoveredLanDevice,
  upsertDiscoveredLanDevice
} from '@baishou/shared'
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
          setDevices((prev) => upsertDiscoveredLanDevice(prev, d))
        },
        (id) => {
          setDevices((prev) => removeDiscoveredLanDevice(prev, id))
        }
      )
    }
  }, [isActive, onStartBroadcasting, onStopBroadcasting, onStartDiscovery, onStopDiscovery])

  const handleSend = useCallback(
    async (device: DiscoveredDevice) => {
      const deviceKey = getLanDeviceDedupKey(device)
      setSendingDevice(deviceKey)
      setSendProgress((prev) => ({ ...prev, [deviceKey]: 0 }))
      await onSendFile(device.ip, device.port, (p) => {
        setSendProgress((prev) => ({ ...prev, [deviceKey]: p }))
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
