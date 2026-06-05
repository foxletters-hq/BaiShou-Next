import * as Network from 'expo-network'
import Zeroconf from 'react-native-zeroconf'
import { FileSystemUploadType, uploadAsync } from './mobile-http-transfer'
import type { IFileSystem } from '@baishou/core-mobile'
import { IArchiveService, ILanSyncService, DiscoveredDevice } from '@baishou/core-mobile'

// We import our custom internal module!
import * as BaishouServer from 'expo-baishou-server'

export class MobileLanSyncService implements ILanSyncService {
  private zeroconf: Zeroconf
  private isBroadcasting = false
  private currentPort = 0
  private currentIp = ''
  private fileReceivedCallback?: (path: string) => void
  private deviceFoundCb?: (d: DiscoveredDevice) => void
  private deviceLostCb?: (d: string) => void
  private serverEventSub: any

  constructor(
    private archiveService: IArchiveService,
    private readonly fileSystem: IFileSystem
  ) {
    this.zeroconf = new Zeroconf()

    this.zeroconf.on('resolved', (service: any) => {
      if (!this.deviceFoundCb) return
      try {
        const records = service.txt || {}
        const device: DiscoveredDevice = {
          nickname: records.nickname || service.name,
          ip: service.host || records.ip?.split(',')[0] || service.addresses?.[0] || 'Unknown',
          port: service.port,
          deviceType: records.device_type || 'other',
          rawServiceId: service.name
        }
        this.deviceFoundCb(device)
      } catch (e) {
        console.warn('Zeroconf parse error', e)
      }
    })

    this.zeroconf.on('remove', (serviceName: string) => {
      if (this.deviceLostCb) this.deviceLostCb(serviceName)
    })
  }

  public async startBroadcasting(): Promise<{
    ip: string
    port: number
    serviceId: string
  } | null> {
    if (this.isBroadcasting) {
      return {
        ip: this.currentIp,
        port: this.currentPort,
        serviceId: `baishou-mobile-${this.currentPort}`
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

    // Register event listener from Native Module
    if (this.serverEventSub) this.serverEventSub.remove()
    this.serverEventSub = BaishouServer.onFileReceived((event) => {
      if (this.fileReceivedCallback) {
        this.fileReceivedCallback(event.path)
      }
    })

    // Publish mDNS
    const safeNickname = 'BaishouMob'
    const uuid = Math.floor(Math.random() * 10000).toString()
    const serviceName = `BaiShou-${safeNickname}-${uuid}`

    this.zeroconf.publishService('tcp', 'baishou', 'local.', serviceName, this.currentPort, {
      nickname: safeNickname,
      ip: ip,
      device_type: 'mobile'
    })

    this.isBroadcasting = true
    return { ip, port: this.currentPort, serviceId: serviceName }
  }

  public async stopBroadcasting(): Promise<void> {
    if (!this.isBroadcasting) return
    this.zeroconf.unpublishService('baishou')
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
    this.deviceFoundCb = onDeviceFound
    this.deviceLostCb = onDeviceLost
    this.zeroconf.scan('baishou', 'tcp', 'local.')
  }

  public async stopDiscovery(): Promise<void> {
    this.zeroconf.stop()
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

      // In React Native Expo, we use FileSystem.uploadAsync for multipart or raw POST!
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
