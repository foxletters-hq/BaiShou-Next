import * as os from 'os'
import { Bonjour, Browser, Service } from 'bonjour-service'
import { DiscoveredDevice } from '@baishou/core-desktop'
import {
  buildLanMdnsHost,
  getLanDeviceDedupKey,
  isExcludedLanIpv4,
  lanDevicesEquivalent,
  LAN_DISCOVERY_REQUERY_MS,
  normalizeLanDeviceType,
  pickBestLanIpv4,
  resolveDiscoveredLanIpv4,
  resolveDiscoveredLanIpv4Candidates
} from '@baishou/shared'

type DiscoveryCallbacks = {
  publishedServiceName: string | null
  onDeviceFound: (device: DiscoveredDevice) => void
  onDeviceLost: (deviceId: string) => void
}

export interface LanPublishOptions {
  host?: string
  interfaceIp?: string | null
  ips?: string[]
}

function ensurePreferredLanAddressRecordsPatch(): void {
  const proto = Service?.prototype as unknown as
    | {
        records?: () => Array<{ type?: string }>
        RecordA?: (
          service: unknown,
          ip: string
        ) => { type: string; name: string; ttl: number; data: string }
        __baishouPatchedRecords?: boolean
      }
    | undefined
  if (!proto || typeof proto.records !== 'function' || proto.__baishouPatchedRecords) {
    return
  }

  const originalRecords = proto.records
  proto.__baishouPatchedRecords = true
  proto.records = function (this: {
    txt?: Record<string, unknown>
    RecordA?: (
      service: unknown,
      ip: string
    ) => { type: string; name: string; ttl: number; data: string }
  }) {
    const baseRecords = originalRecords.call(this)
    const rawTxtIp = typeof this.txt?.ip === 'string' ? this.txt.ip : ''
    const preferredIps = rawTxtIp
      .split(',')
      .map((ip) => ip.trim())
      .filter((ip) => ip && !isExcludedLanIpv4(ip))
    if (preferredIps.length === 0 || typeof this.RecordA !== 'function') {
      return baseRecords
    }

    const nonAddressRecords = baseRecords.filter(
      (record) => record?.type !== 'A' && record?.type !== 'AAAA'
    )
    const aRecords = preferredIps.map((ip) => this.RecordA!(this, ip))
    return [...nonAddressRecords, ...aRecords]
  }
}

/**
 * 负责局域网 mDNS (Bonjour) 服务的广播发布与局域网伙伴嗅探发现。
 */
export class LanDiscovery {
  private bonjour: Bonjour | null = null
  private bonjourInterfaceIp: string | null = null
  private browser: Browser | null = null
  private publishedService: any = null
  private activeDevices = new Map<string, DiscoveredDevice>()
  private serviceNameToDedupKey = new Map<string, string>()
  private requeryTimer: ReturnType<typeof setInterval> | null = null
  private discoveryCallbacks: DiscoveryCallbacks | null = null

  private getBonjour(interfaceIp?: string | null): Bonjour {
    ensurePreferredLanAddressRecordsPatch()
    const targetInterface =
      interfaceIp && !isExcludedLanIpv4(interfaceIp) ? interfaceIp.trim() : null

    if (
      this.bonjour &&
      targetInterface &&
      this.bonjourInterfaceIp !== targetInterface &&
      !this.publishedService &&
      !this.browser
    ) {
      this.bonjour.destroy()
      this.bonjour = null
      this.bonjourInterfaceIp = null
    }

    if (!this.bonjour) {
      this.bonjourInterfaceIp = targetInterface
      this.bonjour = targetInterface
        ? new Bonjour({ interface: targetInterface, bind: '0.0.0.0' } as Record<string, unknown>)
        : new Bonjour()
    }
    return this.bonjour
  }

  public publish(
    name: string,
    port: number,
    txt: Record<string, unknown>,
    options?: LanPublishOptions
  ) {
    this.unpublish()
    const normalizedTxt = Object.fromEntries(
      Object.entries(txt).map(([key, value]) => [key, String(value ?? '')])
    )
    const preferredIps = (options?.ips ?? String(normalizedTxt.ip ?? '').split(','))
      .map((ip) => ip.trim())
      .filter((ip) => ip && !isExcludedLanIpv4(ip))
    if (preferredIps.length > 0 && !normalizedTxt.ip) {
      normalizedTxt.ip = preferredIps.slice(0, 4).join(',')
    }

    const deviceId = String(normalizedTxt.device_id ?? normalizedTxt.deviceId ?? '').trim()
    const host = options?.host || buildLanMdnsHost(os.hostname(), deviceId)
    const interfaceIp = options?.interfaceIp ?? preferredIps[0] ?? null

    if (this.discoveryCallbacks) {
      this.discoveryCallbacks.publishedServiceName = name
    }

    const bj = this.getBonjour(interfaceIp)
    this.publishedService = bj.publish({
      name,
      host,
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
    const ipCandidates = resolveDiscoveredLanIpv4Candidates({
      txt: records,
      addresses: [...txtIps, ...addressIps],
      host: service.host
    })
    const deviceIp =
      ipCandidates[0] ||
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
      ipCandidates,
      port: service.port,
      deviceType: normalizeLanDeviceType({
        txt: records,
        deviceId: String(records.device_id ?? records.deviceId ?? '').trim(),
        nickname: String(records.nickname ?? service.name)
      }),
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
      if (!device.port || device.port <= 0 || device.ip === 'Unknown') {
        return
      }
      this.emitDevice(device, callbacks.onDeviceFound, callbacks.onDeviceLost)
    } catch (e) {
      console.error('Failed to parse mDNS txt string', e)
    }
  }

  private reannouncePublishedService() {
    if (!this.bonjour || !this.publishedService) return
    if (!this.publishedService.activated || this.publishedService.destroyed) return
    try {
      const mdns = (
        this.bonjour as unknown as {
          server?: { mdns?: { respond?: (records: unknown[]) => void } }
        }
      ).server?.mdns
      const records =
        typeof this.publishedService.records === 'function' ? this.publishedService.records() : null
      if (
        mdns &&
        typeof mdns.respond === 'function' &&
        Array.isArray(records) &&
        records.length > 0
      ) {
        mdns.respond(records)
      }
    } catch (e) {
      console.warn('[LanDiscovery] reannounce failed:', e)
    }
  }

  private triggerDiscoveryRequery() {
    this.reannouncePublishedService()
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
    onDeviceLost: (deviceId: string) => void,
    interfaceIp?: string | null
  ) {
    this.stopDiscovery()
    this.discoveryCallbacks = { publishedServiceName, onDeviceFound, onDeviceLost }

    const bj = this.getBonjour(interfaceIp)
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
    this.bonjourInterfaceIp = null
  }

  public hasPublishedService(): boolean {
    return !!this.publishedService
  }
}
