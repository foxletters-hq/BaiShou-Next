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
