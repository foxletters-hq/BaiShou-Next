import { Platform } from 'react-native'
import * as Network from 'expo-network'
import Zeroconf, { ImplType } from 'react-native-zeroconf'
import { FileSystemUploadType, uploadAsync } from './mobile-http-transfer'
import type { IFileSystem } from '@baishou/core-mobile'
import { IArchiveService, ILanSyncService, DiscoveredDevice } from '@baishou/core-mobile'
import {
  LAN_DISCOVERY_RESCAN_MS,
  buildLanServiceName,
  getLanDeviceDedupKey,
  isPrivateLanIpv4,
  lanDevicesEquivalent,
  pickBestLanIpv4,
  resolveDiscoveredLanIpv4
} from '@baishou/shared'

import * as BaishouServer from 'expo-baishou-server'
import { ensureLanDiscoveryPermissions } from './lan-discovery-permission.service'

const ANDROID_MDNS_IMPL = ImplType.DNSSD

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
  private lanUploadStartedSub: { remove: () => void } | null = null
  private lanUploadProgressSub: { remove: () => void } | null = null
  private lanUploadStartedCallback?: (totalBytes: number) => void
  private lanUploadProgressCallback?: (writtenBytes: number, totalBytes: number) => void
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

    this.zeroconf.on('error', (err: unknown) => {
      const message = err instanceof Error ? err.message : String(err)
      if (message.includes('CHANGE_WIFI_MULTICAST_STATE')) {
        console.error(
          '[MobileLanSyncService] 缺少 Android 组播权限，请执行 pnpm dev:mobile:clear 重新安装开发版',
          err
        )
        return
      }
      console.error('[MobileLanSyncService] zeroconf error', err)
    })
  }

  private getAndroidMdnsImpl() {
    return Platform.OS === 'android' ? ANDROID_MDNS_IMPL : undefined
  }

  private scanLanServices() {
    const impl = this.getAndroidMdnsImpl()
    if (impl) {
      this.zeroconf.scan('baishou', 'tcp', 'local.', impl)
    } else {
      this.zeroconf.scan('baishou', 'tcp', 'local.')
    }
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

    if (this.lanUploadStartedSub) this.lanUploadStartedSub.remove()
    if (this.lanUploadProgressSub) this.lanUploadProgressSub.remove()
    this.lanUploadStartedSub = BaishouServer.onLanUploadStarted((event) => {
      this.lanUploadStartedCallback?.(event.totalBytes)
    })
    this.lanUploadProgressSub = BaishouServer.onLanUploadProgress((event) => {
      this.lanUploadProgressCallback?.(event.writtenBytes, event.totalBytes)
    })

    const safeNickname = 'BaishouMob'
    const serviceName = buildLanServiceName(safeNickname, this.lanDeviceId)
    const impl = this.getAndroidMdnsImpl()
    if (this.publishedServiceName && this.publishedServiceName !== serviceName) {
      if (impl) {
        this.zeroconf.unpublishService(this.publishedServiceName, impl)
      } else {
        this.zeroconf.unpublishService(this.publishedServiceName)
      }
    }
    this.publishedServiceName = serviceName

    const txt = {
      nickname: safeNickname,
      ip,
      device_type: 'mobile',
      device_id: this.lanDeviceId
    }
    if (impl) {
      this.zeroconf.publishService('baishou', 'tcp', 'local.', serviceName, this.currentPort, txt, impl)
    } else {
      this.zeroconf.publishService('baishou', 'tcp', 'local.', serviceName, this.currentPort, txt)
    }

    this.isBroadcasting = true
    return { ip, port: this.currentPort, serviceId: serviceName, deviceId: this.lanDeviceId }
  }

  public async stopBroadcasting(): Promise<void> {
    if (!this.isBroadcasting) return
    if (this.publishedServiceName) {
      const impl = this.getAndroidMdnsImpl()
      if (impl) {
        this.zeroconf.unpublishService(this.publishedServiceName, impl)
      } else {
        this.zeroconf.unpublishService(this.publishedServiceName)
      }
    }
    this.publishedServiceName = null
    BaishouServer.stopServer()
    if (this.serverEventSub) {
      this.serverEventSub.remove()
      this.serverEventSub = null
    }
    if (this.lanUploadStartedSub) {
      this.lanUploadStartedSub.remove()
      this.lanUploadStartedSub = null
    }
    if (this.lanUploadProgressSub) {
      this.lanUploadProgressSub.remove()
      this.lanUploadProgressSub = null
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

    await this.stopDiscovery()
    this.deviceFoundCb = onDeviceFound
    this.deviceLostCb = onDeviceLost
    this.activeDevices.clear()
    this.serviceNameToDedupKey.clear()

    this.scanLanServices()
    if (this.rescanTimer) clearInterval(this.rescanTimer)
    this.rescanTimer = setInterval(() => {
      this.scanLanServices()
    }, LAN_DISCOVERY_RESCAN_MS)
  }

  public async stopDiscovery(): Promise<void> {
    if (this.rescanTimer) {
      clearInterval(this.rescanTimer)
      this.rescanTimer = null
    }
    const impl = this.getAndroidMdnsImpl()
    if (impl) {
      this.zeroconf.stop(impl)
    } else {
      this.zeroconf.stop()
    }
    this.activeDevices.clear()
    this.serviceNameToDedupKey.clear()
    this.deviceFoundCb = undefined
    this.deviceLostCb = undefined
  }

  private async findReachableIp(hostStr: string, port: number): Promise<string | null> {
    const hosts = hostStr.split(',').map((h) => h.trim()).filter(Boolean)
    if (hosts.length === 0 || hosts[0] === 'Unknown') return null

    for (const host of hosts) {
      try {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), 3000)
        const response = await fetch(`http://${host}:${port}/info`, { signal: controller.signal })
        clearTimeout(timer)
        if (response.ok) return host
      } catch {
        // try next candidate
      }
    }

    const fallback = pickBestLanIpv4(hosts)
    if (fallback && isPrivateLanIpv4(fallback)) {
      console.warn(
        '[MobileLanSyncService] /info probe failed, fallback to direct LAN IP',
        fallback,
        port
      )
      return fallback
    }
    return null
  }

  public async sendFile(
    ip: string,
    port: number,
    onProgress?: (percent: number) => void
  ): Promise<boolean> {
    try {
      const reachableHost = await this.findReachableIp(ip, port)
      if (!reachableHost) {
        console.error('[MobileLanSyncService] no reachable LAN IP for', ip, port)
        return false
      }

      const zipPath = await this.archiveService.exportToTempFile()
      if (!zipPath) return false

      const url = `http://${reachableHost}:${port}/upload`

      const response = await uploadAsync(url, zipPath, {
        httpMethod: 'POST',
        uploadType: FileSystemUploadType.BINARY_CONTENT
      })

      await this.fileSystem.unlink(zipPath).catch(() => {})

      if (response.status === 200) {
        onProgress?.(100)
        return true
      }
      return false
    } catch (e) {
      console.error('[MobileLanSyncService] failed to push file', e)
      return false
    }
  }

  public onFileReceived(callback: (zipFilePath: string) => void): void {
    this.fileReceivedCallback = callback
  }

  public onLanUploadStarted(callback: (totalBytes: number) => void): void {
    this.lanUploadStartedCallback = callback
  }

  public onLanUploadProgress(callback: (writtenBytes: number, totalBytes: number) => void): void {
    this.lanUploadProgressCallback = callback
  }
}
