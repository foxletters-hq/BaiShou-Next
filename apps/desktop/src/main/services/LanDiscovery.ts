import { Bonjour, Browser } from 'bonjour-service'
import { DiscoveredDevice } from '@baishou/core-desktop'
import {
  getLanDeviceDedupKey,
  lanDevicesEquivalent,
  LAN_DISCOVERY_REQUERY_MS,
  parseLanTxtIpv4,
  pickBestLanIpv4,
  resolveDiscoveredLanIpv4
} from '@baishou/shared'

type DiscoveryCallbacks = {
  publishedServiceName: string | null
  onDeviceFound: (device: DiscoveredDevice) => void
  onDeviceLost: (deviceId: string) => void
}

/**
 * 负责局域网 mDNS (Bonjour) 服务的广播发布与局域网伙伴嗅探发现。
 */
export class LanDiscovery {
  private bonjour: Bonjour | null = null
  private browser: Browser | null = null
  private publishedService: any = null
  private activeDevices = new Map<string, DiscoveredDevice>()
  private serviceNameToDedupKey = new Map<string, string>()
  private requeryTimer: ReturnType<typeof setInterval> | null = null
  private discoveryCallbacks: DiscoveryCallbacks | null = null

  private getBonjour(): Bonjour {
    if (!this.bonjour) {
      this.bonjour = new Bonjour()
    }
    return this.bonjour
  }

  public publish(name: string, port: number, txt: Record<string, unknown>) {
    this.unpublish()
    const bj = this.getBonjour()
    const normalizedTxt = Object.fromEntries(
      Object.entries(txt).map(([key, value]) => [key, String(value ?? '')])
    )
    this.publishedService = bj.publish({
      name,
      type: 'baishou',
      protocol: 'tcp',
      port,
      txt: normalizedTxt,
      // Windows 上 probe 偶发误判重名导致广播静默失败；禁用 IPv6 减少解析异常
      probe: false,
      disableIPv6: true
    })
    return this.publishedService
  }

  public unpublish() {
    if (this.publishedService) {
      this.publishedService.stop()
      this.publishedService = null
    }
  }

  private parseDevice(service: {
    name: string
    port: number
    txt?: Record<string, unknown>
    addresses?: string[]
    host?: string
  }): DiscoveredDevice {
    const records = (service.txt ?? {}) as Record<string, unknown>
    const txtIps = String(records.ip ?? '')
      .split(',')
      .map((ip) => ip.trim())
      .filter(Boolean)
    const addressIps = (service.addresses ?? []).filter((addr) => !addr.includes(':'))
    const deviceIp =
      resolveDiscoveredLanIpv4({
        txt: records,
        addresses: [...txtIps, ...addressIps],
        host: service.host
      }) ||
      pickBestLanIpv4([...txtIps, ...addressIps]) ||
      txtIps[0] ||
      addressIps[0] ||
      'Unknown'

    return {
      deviceId: String(records.device_id ?? records.deviceId ?? '').trim(),
      nickname: String(records.nickname ?? service.name),
      ip: deviceIp,
      port: service.port,
      deviceType: (records.device_type as DiscoveredDevice['deviceType']) || 'other',
      rawServiceId: service.name
    }
  }

  private emitDevice(
    device: DiscoveredDevice,
    onDeviceFound: (device: DiscoveredDevice) => void,
    onDeviceLost: (deviceId: string) => void
  ) {
    const dedupKey = getLanDeviceDedupKey(device)
    const previous = this.activeDevices.get(dedupKey)
    if (previous && lanDevicesEquivalent(previous, device)) {
      onDeviceFound(device)
      return
    }

    if (previous && previous.rawServiceId !== device.rawServiceId) {
      this.serviceNameToDedupKey.delete(previous.rawServiceId)
      onDeviceLost(previous.deviceId || previous.rawServiceId)
    }

    this.activeDevices.set(dedupKey, device)
    this.serviceNameToDedupKey.set(device.rawServiceId, dedupKey)
    onDeviceFound(device)
  }

  private handleDiscoveredService(service: {
    name: string
    port: number
    txt?: Record<string, unknown>
    addresses?: string[]
    host?: string
  }) {
    const callbacks = this.discoveryCallbacks
    if (!callbacks) return

    try {
      if (callbacks.publishedServiceName && service.name === callbacks.publishedServiceName) {
        return
      }

      const device = this.parseDevice(service)
      if (!parseLanTxtIpv4(service.txt as Record<string, unknown>) && device.ip === 'Unknown') {
        return
      }
      this.emitDevice(device, callbacks.onDeviceFound, callbacks.onDeviceLost)
    } catch (e) {
      console.error('Failed to parse mDNS txt string', e)
    }
  }

  private triggerDiscoveryRequery() {
    if (!this.browser) return
    try {
      this.browser.update()
    } catch (e) {
      console.warn('[LanDiscovery] browser.update failed:', e)
    }
  }

  private startRequeryTimer() {
    if (this.requeryTimer) clearInterval(this.requeryTimer)
    this.requeryTimer = setInterval(() => {
      this.triggerDiscoveryRequery()
    }, LAN_DISCOVERY_REQUERY_MS)
  }

  private stopRequeryTimer() {
    if (this.requeryTimer) {
      clearInterval(this.requeryTimer)
      this.requeryTimer = null
    }
  }

  public startDiscovery(
    publishedServiceName: string | null,
    onDeviceFound: (device: DiscoveredDevice) => void,
    onDeviceLost: (deviceId: string) => void
  ) {
    this.stopDiscovery()
    this.discoveryCallbacks = { publishedServiceName, onDeviceFound, onDeviceLost }

    const bj = this.getBonjour()
    this.browser = bj.find({ type: 'baishou', protocol: 'tcp' }, (service) => {
      this.handleDiscoveredService(service)
    })

    // 不处理 down 事件：bonjour-service 在 Windows 上会因 TTL 或 re-query 误报 down，
    // 且 periodic update() 会在响应到达前先触发 down，导致设备不断闪现消失。
    // 真正的设备离线由 UI 层的 2 分钟 stale 定时器负责清理（与移动端策略一致）。

    // 首次 up 时 TXT/SRV 可能尚未解析完成；后续 update 会补全
    this.browser.on('txt-update', (service) => {
      this.handleDiscoveredService(service)
    })
    this.browser.on('srv-update', (service) => {
      this.handleDiscoveredService(service)
    })

    // 主动 re-query，对齐移动端 zeroconf.scan()，避免 Windows 被动等待 Android 广播
    this.triggerDiscoveryRequery()
    setTimeout(() => this.triggerDiscoveryRequery(), 800)
    this.startRequeryTimer()
  }

  public stopDiscovery() {
    this.stopRequeryTimer()
    this.discoveryCallbacks = null
    if (this.browser) {
      this.browser.stop()
      this.browser = null
    }
    this.activeDevices.clear()
    this.serviceNameToDedupKey.clear()
  }

  public destroy() {
    this.unpublish()
    this.stopDiscovery()
    if (this.bonjour) {
      this.bonjour.destroy()
      this.bonjour = null
    }
  }

  public hasPublishedService(): boolean {
    return !!this.publishedService
  }
}
