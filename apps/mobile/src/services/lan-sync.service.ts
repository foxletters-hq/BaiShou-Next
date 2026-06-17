import * as Network from 'expo-network'
import Zeroconf from 'react-native-zeroconf'
import { FileSystemUploadType, uploadAsync } from './mobile-http-transfer'
import type { IFileSystem } from '@baishou/core-mobile'
import { IArchiveService, ILanSyncService, DiscoveredDevice } from '@baishou/core-mobile'
import {
  LAN_DISCOVERY_RESCAN_MS,
  buildLanServiceName,
  getLanDeviceDedupKey,
  lanDevicesEquivalent,
  resolveDiscoveredLanIpv4
} from '@baishou/shared'

import * as BaishouServer from 'expo-baishou-server'
import { ensureLanDiscoveryPermissions } from './lan-discovery-permission.service'

export class MobileLanSyncService implements ILanSyncService {
  private zeroconf: Zeroconf
  private isBroadcasting = false
  private currentPort = 0
  private currentIp = ''
  private publishedServiceName: string | null = null
  private fileReceivedCallback?: (path: string) => void
  private deviceFoundCb?: (d: DiscoveredDevice) => void
  private deviceLostCb?: (d: string) => void
  private serverEventSub: { remove: () => void } | null = null
  private rescanTimer: ReturnType<typeof setInterval> | null = null
  private activeDevices = new Map<string, DiscoveredDevice>()
  private serviceNameToDedupKey = new Map<string, string>()

  constructor(
    private archiveService: IArchiveService,
    private readonly fileSystem: IFileSystem,
    private readonly lanDeviceId: string
  ) {
    this.zeroconf = new Zeroconf()

    this.zeroconf.on('published', (service: { name?: string }) => {
      if (service?.name) {
        this.publishedServiceName = service.name
      }
    })

    const handleService = (service: any) => {
      if (!this.deviceFoundCb) return
      if (this.publishedServiceName && service.name === this.publishedServiceName) return

      try {
        const records = service.txt || {}
        const device: DiscoveredDevice = {
          deviceId: String(records.device_id ?? records.deviceId ?? '').trim(),
          nickname: records.nickname || service.name,
          ip: resolveDiscoveredLanIpv4({
            txt: records,
            addresses: service.addresses,
            host: service.host
          }),
          port: service.port,
          deviceType: records.device_type || 'other',
          rawServiceId: service.name
        }

        if (device.ip === 'Unknown') return
        this.emitDevice(device)
      } catch (e) {
        console.warn('Zeroconf parse error', e)
      }
    }

    this.zeroconf.on('found', handleService)
    this.zeroconf.on('resolved', handleService)

    this.zeroconf.on('remove', (serviceName: string) => {
      this.removeDeviceByServiceName(serviceName)
    })
  }

  private emitDevice(device: DiscoveredDevice) {
    if (!this.deviceFoundCb) return

    const dedupKey = getLanDeviceDedupKey(device)
    const previous = this.activeDevices.get(dedupKey)
    if (previous && lanDevicesEquivalent(previous, device)) return

    if (previous && previous.rawServiceId !== device.rawServiceId) {
      this.serviceNameToDedupKey.delete(previous.rawServiceId)
      this.deviceLostCb?.(previous.deviceId || previous.rawServiceId)
    }

    this.activeDevices.set(dedupKey, device)
    this.serviceNameToDedupKey.set(device.rawServiceId, dedupKey)
    this.deviceFoundCb(device)
  }

  private removeDeviceByServiceName(serviceName: string) {
    const dedupKey = this.serviceNameToDedupKey.get(serviceName)
    if (!dedupKey) {
      this.deviceLostCb?.(serviceName)
      return
    }

    const device = this.activeDevices.get(dedupKey)
    this.activeDevices.delete(dedupKey)
    this.serviceNameToDedupKey.delete(serviceName)
    this.deviceLostCb?.(device?.deviceId || serviceName)
  }

  public async startBroadcasting(): Promise<{
    ip: string
    port: number
    serviceId: string
    deviceId: string
  } | null> {
    if (this.isBroadcasting) {
      return {
        ip: this.currentIp,
        port: this.currentPort,
        serviceId: this.publishedServiceName || `BaiShou-Mobile-${this.currentPort}`,
        deviceId: this.lanDeviceId
      }
    }

    const ip = await Network.getIpAddressAsync()
    if (!ip || ip === '0.0.0.0') throw new Error('No local IPv4 found')

    if (!BaishouServer.isBaishouServerAvailable()) {
      throw new Error(
        '局域网服务需要 ExpoBaishouServer 原生模块。请执行 pnpm dev:mobile:clear 重新安装开发版。'
      )
    }

    this.currentPort = BaishouServer.startServer(0)
    if (this.currentPort <= 0) {
      throw new Error('Failed to start native NanoHTTPD server')
    }

    this.currentIp = ip

    if (this.serverEventSub) this.serverEventSub.remove()
    this.serverEventSub = BaishouServer.onFileReceived((event) => {
      if (this.fileReceivedCallback) {
        this.fileReceivedCallback(event.path)
      }
    })

    const safeNickname = 'BaishouMob'
    const serviceName = buildLanServiceName(safeNickname, this.lanDeviceId)
    if (this.publishedServiceName && this.publishedServiceName !== serviceName) {
      this.zeroconf.unpublishService(this.publishedServiceName)
    }
    this.publishedServiceName = serviceName

    this.zeroconf.publishService('baishou', 'tcp', 'local.', serviceName, this.currentPort, {
      nickname: safeNickname,
      ip,
      device_type: 'mobile',
      device_id: this.lanDeviceId
    })

    this.isBroadcasting = true
    return { ip, port: this.currentPort, serviceId: serviceName, deviceId: this.lanDeviceId }
  }

  public async stopBroadcasting(): Promise<void> {
    if (!this.isBroadcasting) return
    if (this.publishedServiceName) {
      this.zeroconf.unpublishService(this.publishedServiceName)
    }
    this.publishedServiceName = null
    BaishouServer.stopServer()
    if (this.serverEventSub) {
      this.serverEventSub.remove()
      this.serverEventSub = null
    }
    this.isBroadcasting = false
  }

  public async startDiscovery(
    onDeviceFound: (device: DiscoveredDevice) => void,
    onDeviceLost: (deviceId: string) => void
  ): Promise<void> {
    const granted = await ensureLanDiscoveryPermissions()
    if (!granted) {
      throw new Error('需要授予附近设备或定位权限才能扫描局域网设备')
    }

    this.deviceFoundCb = onDeviceFound
    this.deviceLostCb = onDeviceLost
    this.activeDevices.clear()
    this.serviceNameToDedupKey.clear()

    this.zeroconf.scan('baishou', 'tcp', 'local.')
    if (this.rescanTimer) clearInterval(this.rescanTimer)
    this.rescanTimer = setInterval(() => {
      this.zeroconf.scan('baishou', 'tcp', 'local.')
    }, LAN_DISCOVERY_RESCAN_MS)
  }

  public async stopDiscovery(): Promise<void> {
    if (this.rescanTimer) {
      clearInterval(this.rescanTimer)
      this.rescanTimer = null
    }
    this.zeroconf.stop()
    this.activeDevices.clear()
    this.serviceNameToDedupKey.clear()
    this.deviceFoundCb = undefined
    this.deviceLostCb = undefined
  }

  public async sendFile(
    ip: string,
    port: number,
    onProgress?: (percent: number) => void
  ): Promise<boolean> {
    try {
      const zipPath = await this.archiveService.exportToTempFile()
      if (!zipPath) return false

      const url = `http://${ip}:${port}/upload`

      const response = await uploadAsync(url, zipPath, {
        httpMethod: 'POST',
        uploadType: FileSystemUploadType.BINARY_CONTENT
      })

      await this.fileSystem.unlink(zipPath).catch(() => {})

      return response.status === 200
    } catch (e) {
      console.error('[MobileLanSyncService] failed to push file', e)
      return false
    }
  }

  public onFileReceived(callback: (zipFilePath: string) => void): void {
    this.fileReceivedCallback = callback
  }
}
