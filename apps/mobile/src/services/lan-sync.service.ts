/* eslint-disable max-lines -- 局域网发现、mDNS 广播与 MCP 共享 HTTP server 的生命周期集中管理，拆分易引入竞态 */
import i18n from 'i18next'
import { Platform } from 'react-native'
import * as Network from 'expo-network'
import Zeroconf, { ImplType } from 'react-native-zeroconf'
import type { IFileSystem } from '@baishou/core-mobile'
import { IArchiveService, ILanSyncService, DiscoveredDevice } from '@baishou/core-mobile'
import {
  LAN_DISCOVERY_RESCAN_MS,
  buildLanServiceName,
  getLanDeviceDedupKey,
  isExcludedLanIpv4,
  lanDevicesEquivalent,
  normalizeLanDeviceType,
  pickBestLanIpv4,
  resolveDiscoveredLanIpv4,
  resolveDiscoveredLanIpv4Candidates
} from '@baishou/shared'

import * as BaishouServer from 'expo-baishou-server'
import { ensureLanDiscoveryPermissions } from './lan-discovery-permission.service'
import { sendLanFile } from './lan-file-transfer'

/**
 * Android mDNS：发布与发现分栈，避免嵌入式 DNSSD 同时注册+浏览崩溃。
 * - 发现走 DNSSD：嵌入式 mDNSResponder 对 Windows Bonjour 桌面端更稳
 * - 发布走 NSD：系统栈广播，桌面/其他手机更容易看见本机
 *
 * DNSSD 的 scan() 会先 stop 再启 nativeLoop；stop 会 post nativeExit(5s)。
 * 周期 rescan 会和这条延迟退出抢跑，libjdns_sd_embedded 会 SIGSEGV。
 * DNSSD browse 本身是长连接，启动后保持即可，不要反复 stop/scan。
 */
const ANDROID_PUBLISH_MDNS_IMPL = ImplType.NSD
const ANDROID_DISCOVERY_MDNS_IMPL = ImplType.DNSSD
const ANDROID_MDNS_SETTLE_MS = 150

export class MobileLanSyncService implements ILanSyncService {
  private zeroconf: Zeroconf
  private discoveryActive = false
  private mdnsChain: Promise<void> = Promise.resolve()
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
  private lanUploadFailedSub: { remove: () => void } | null = null
  private lanUploadStartedCallback?: (totalBytes: number) => void
  private lanUploadProgressCallback?: (writtenBytes: number, totalBytes: number) => void
  private lanUploadFailedCallback?: (reason: string) => void
  private rescanTimer: ReturnType<typeof setInterval> | null = null
  private activeDevices = new Map<string, DiscoveredDevice>()
  private serviceNameToDedupKey = new Map<string, string>()
  private serverPortSub: { remove: () => void } | null = null
  private ownsHttpServer = false
  private serverTakeoverInFlight = false
  private ownServerStartInFlight = false
  private broadcastGeneration = 0

  constructor(
    private archiveService: IArchiveService,
    private readonly fileSystem: IFileSystem,
    private readonly lanDeviceId: string,
    private readonly isMcpServerRunning?: () => boolean
  ) {
    this.zeroconf = new Zeroconf()

    this.zeroconf.on('published', (service: { name?: string }) => {
      if (service?.name) {
        this.publishedServiceName = service.name
      }
    })

    const handleService = (service: any) => {
      if (!this.deviceFoundCb) return
      if (!service || typeof service !== 'object' || !service.name) return
      if (this.publishedServiceName && service.name === this.publishedServiceName) return

      try {
        const records = (service.txt || {}) as Record<string, unknown>
        const deviceId = String(records.device_id ?? records.deviceId ?? '').trim()
        const nickname = String(records.nickname ?? service.name ?? '').trim() || service.name
        const ipCandidates = resolveDiscoveredLanIpv4Candidates({
          txt: records,
          addresses: service.addresses,
          host: service.host
        })
        const device: DiscoveredDevice = {
          deviceId,
          nickname,
          ip:
            ipCandidates[0] ||
            resolveDiscoveredLanIpv4({
              txt: records,
              addresses: service.addresses,
              host: service.host
            }),
          ipCandidates,
          port: service.port,
          deviceType: normalizeLanDeviceType({
            txt: records,
            deviceId,
            nickname
          }),
          rawServiceId: service.name
        }

        if (device.ip === 'Unknown') return
        this.emitDevice(device)
      } catch (e) {
        console.warn('Zeroconf parse error', e)
      }
    }

    // found 只带服务名字符串，真正可用字段在 resolved
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

  private getAndroidPublishImpl() {
    return Platform.OS === 'android' ? ANDROID_PUBLISH_MDNS_IMPL : undefined
  }

  private getAndroidDiscoveryImpl() {
    return Platform.OS === 'android' ? ANDROID_DISCOVERY_MDNS_IMPL : undefined
  }

  private mdnsSettle(): Promise<void> {
    if (Platform.OS !== 'android') return Promise.resolve()
    return new Promise((resolve) => setTimeout(resolve, ANDROID_MDNS_SETTLE_MS))
  }

  private enqueueMdns(
    work: () => void | Promise<void>,
    options?: { propagateError?: boolean }
  ): Promise<void> {
    const run = this.mdnsChain.then(async () => {
      await work()
    })
    // 队列本身永远保持可继续执行；需要感知发布/扫描失败时由调用方 await run。
    this.mdnsChain = run.catch((e) => {
      console.warn('[MobileLanSyncService] mDNS queue error', e)
    })
    return options?.propagateError ? run : this.mdnsChain
  }

  private scanLanServices() {
    const impl = this.getAndroidDiscoveryImpl()
    if (impl) {
      this.zeroconf.scan('baishou', 'tcp', 'local.', impl)
    } else {
      this.zeroconf.scan('baishou', 'tcp', 'local.')
    }
  }

  /** 嵌入式 DNSSD 不可 stop+scan 热重启；NSD / iOS 仍可周期全量扫 */
  private shouldRestartDiscoveryScan() {
    return this.getAndroidDiscoveryImpl() !== ImplType.DNSSD
  }

  private emitDevice(device: DiscoveredDevice) {
    if (!this.deviceFoundCb) return

    const dedupKey = getLanDeviceDedupKey(device)
    const previous = this.activeDevices.get(dedupKey)
    if (previous && lanDevicesEquivalent(previous, device)) {
      this.deviceFoundCb(device)
      return
    }

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

  private ensureServerPortSubscription(): void {
    if (this.serverPortSub) return
    // 独立 LAN server 不需要跟随 MCP 的端口变化
    if (this.hasIndependentLanServer()) return
    this.serverPortSub = BaishouServer.onHttpServerPortChanged((event) => {
      void this.handleHttpServerPortChanged(event)
    })
  }

  private getNativeServerPort(): number {
    try {
      return this.hasIndependentLanServer()
        ? BaishouServer.getLanServerPort()
        : BaishouServer.getServerPort()
    } catch {
      return 0
    }
  }

  private isMcpClaimRunning(): boolean {
    try {
      return this.isMcpServerRunning?.() === true
    } catch {
      // MCP 服务销毁过程中不阻塞局域网降级
      return false
    }
  }

  private hasIndependentLanServer(): boolean {
    try {
      return BaishouServer.supportsIndependentLanServer()
    } catch {
      return false
    }
  }

  /**
   * 兼容旧 APK：MCP 与 LAN 共用一个原生 HTTP server 时，LAN 作为“乘客”复用/接管。
   * 新 APK 有独立 LAN server，不会订阅该事件。
   */
  private async handleHttpServerPortChanged(event: {
    port: number
    requestedPort?: number
  }): Promise<void> {
    if (this.hasIndependentLanServer()) return
    const port = event.port
    if (!this.isBroadcasting) return
    if (typeof port !== 'number' || !Number.isFinite(port)) return

    if (port > 0) {
      if (this.ownServerStartInFlight) {
        this.currentPort = port
        this.ownsHttpServer = true
        return
      }
      if (port === this.currentPort) {
        // MCP 用固定端口重启且恰好复用同一端口时，server 已归 MCP 所有
        if ((event.requestedPort ?? 0) > 0 && this.ownsHttpServer) {
          this.ownsHttpServer = false
        }
        return
      }
      this.currentPort = port
      this.ownsHttpServer = false
      try {
        await this.republishBroadcast()
      } catch (e) {
        console.warn('[MobileLanSyncService] failed to republish after server port change', e)
      }
      return
    }

    // server 被 MCP 关闭而 LAN 仍在广播：接管并重新启动一个 LAN server。
    if (this.serverTakeoverInFlight) return
    this.serverTakeoverInFlight = true
    try {
      this.ownServerStartInFlight = true
      let newPort = 0
      try {
        newPort = BaishouServer.startServer(0)
      } finally {
        this.ownServerStartInFlight = false
      }
      if (newPort <= 0) throw new Error('Failed to restart LAN HTTP server')
      if (!this.isBroadcasting) {
        // 接管途中页面已关闭，不要留下孤儿 server
        BaishouServer.stopServer()
        this.ownsHttpServer = false
        return
      }
      this.currentPort = newPort
      this.ownsHttpServer = true
      await this.republishBroadcast()
    } catch (e) {
      console.error('[MobileLanSyncService] failed to take over HTTP server', e)
      await this.stopBroadcasting().catch(() => {})
    } finally {
      this.serverTakeoverInFlight = false
    }
  }

  private async publishBroadcast(
    serviceName: string,
    ip: string,
    port: number,
    impl: ReturnType<MobileLanSyncService['getAndroidPublishImpl']>
  ): Promise<void> {
    await this.enqueueMdns(
      async () => {
        if (this.publishedServiceName) {
          try {
            if (impl) {
              this.zeroconf.unpublishService(this.publishedServiceName, impl)
            } else {
              this.zeroconf.unpublishService(this.publishedServiceName)
            }
          } catch {
            // 服务已被系统回收时忽略，继续发布新端口
          }
          await this.mdnsSettle()
        }
        this.publishedServiceName = serviceName

        const txt = {
          nickname: 'BaishouMob',
          ip,
          device_type: 'mobile',
          // 短键兼容 Android NSD「建议 ≤9 字符」；解析端两者都认
          dtype: 'mobile',
          device_id: this.lanDeviceId
        }
        if (impl) {
          this.zeroconf.publishService('baishou', 'tcp', 'local.', serviceName, port, txt, impl)
        } else {
          this.zeroconf.publishService('baishou', 'tcp', 'local.', serviceName, port, txt)
        }
      },
      { propagateError: true }
    )
  }

  private async republishBroadcast(): Promise<void> {
    if (!this.isBroadcasting || this.currentPort <= 0 || !this.currentIp) return
    const serviceName = buildLanServiceName('BaishouMob', this.lanDeviceId)
    await this.publishBroadcast(
      serviceName,
      this.currentIp,
      this.currentPort,
      this.getAndroidPublishImpl()
    )
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

    const generation = ++this.broadcastGeneration

    const rawIp = await Network.getIpAddressAsync()
    if (!rawIp || rawIp === '0.0.0.0' || isExcludedLanIpv4(rawIp)) {
      throw new Error('No usable local IPv4 found')
    }
    const ip = pickBestLanIpv4([rawIp]) ?? rawIp

    if (!BaishouServer.isBaishouServerAvailable()) {
      throw new Error(
        i18n.t(
          'auto.apps.mobile.src.services.lan.sync.service.L192',
          '局域网服务需要 ExpoBaishouServer 原生模块。请执行 pnpm dev:mobile:clear 重新安装开发版。'
        )
      )
    }

    this.ensureServerPortSubscription()

    if (this.hasIndependentLanServer()) {
      // 新 APK：LAN 使用自己的原生 server，MCP 启停完全不影响传输
      this.currentPort = BaishouServer.startLanServer(0)
      if (this.currentPort <= 0) {
        throw new Error('Failed to start independent LAN HTTP server')
      }
      this.ownsHttpServer = true
    } else {
      // 旧 APK 兼容：MCP / LAN 共用一个原生 server，按原逻辑复用或降级
      let mcpRunning = this.isMcpClaimRunning()
      let nativePort = this.getNativeServerPort()

      // MCP 启停过程中原生端口可能短暂为 0。先给它一个很短的窗口；
      // 仍不可用就回退到 LAN 自有 server，绝不能因此让整个传输页停止。
      for (let attempt = 0; mcpRunning && nativePort <= 0 && attempt < 5; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 100))
        mcpRunning = this.isMcpClaimRunning()
        nativePort = this.getNativeServerPort()
      }

      if (mcpRunning && nativePort > 0) {
        this.currentPort = nativePort
        this.ownsHttpServer = false
      } else {
        this.currentPort = BaishouServer.startServer(0)
        if (this.currentPort <= 0) {
          throw new Error('Failed to start native NanoHTTPD server')
        }
        this.ownsHttpServer = true
      }
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
    if (this.lanUploadFailedSub) this.lanUploadFailedSub.remove()
    this.lanUploadStartedSub = BaishouServer.onLanUploadStarted((event) => {
      this.lanUploadStartedCallback?.(event.totalBytes)
    })
    this.lanUploadProgressSub = BaishouServer.onLanUploadProgress((event) => {
      this.lanUploadProgressCallback?.(event.writtenBytes, event.totalBytes)
    })
    try {
      this.lanUploadFailedSub = BaishouServer.onLanUploadFailed((event) => {
        this.lanUploadFailedCallback?.(event.reason)
      })
    } catch {
      // 旧原生模块未声明该事件；接收失败时最多保持旧行为，不影响正常传输
      this.lanUploadFailedSub = null
    }

    const serviceName = buildLanServiceName('BaishouMob', this.lanDeviceId)
    try {
      await this.publishBroadcast(serviceName, ip, this.currentPort, this.getAndroidPublishImpl())
    } catch (e) {
      // 发布失败也必须停掉自己启动的 HTTP 服务；复用 MCP server 时不能误杀 MCP
      await this.stopBroadcasting().catch(() => {})
      throw e
    }

    if (generation !== this.broadcastGeneration) {
      // 发布期间页面已关闭/已重启，撤销这次启动，避免留下幽灵广播
      await this.stopBroadcasting().catch(() => {})
      return null
    }

    this.isBroadcasting = true
    return { ip, port: this.currentPort, serviceId: serviceName, deviceId: this.lanDeviceId }
  }

  public async stopBroadcasting(): Promise<void> {
    this.broadcastGeneration += 1
    const wasBroadcasting = this.isBroadcasting
    this.isBroadcasting = false
    if (wasBroadcasting || this.publishedServiceName) {
      await this.enqueueMdns(async () => {
        if (this.publishedServiceName) {
          const impl = this.getAndroidPublishImpl()
          if (impl) {
            this.zeroconf.unpublishService(this.publishedServiceName, impl)
          } else {
            this.zeroconf.unpublishService(this.publishedServiceName)
          }
          await this.mdnsSettle()
        }
        this.publishedServiceName = null
      })
    }
    this.publishedServiceName = null
    if (this.ownsHttpServer) {
      if (this.hasIndependentLanServer()) {
        // 独立 LAN server：只停自己的，不碰 MCP
        BaishouServer.stopLanServer()
      } else {
        const nativePort = this.getNativeServerPort()
        // 端口变化事件可能还没送达：只要 MCP 已接管或原生端口已不是 LAN 启动的那个，
        // 就不能由 LAN 页面退出时顺手 stopServer，否则会把 MCP 一起停掉。
        if (nativePort === this.currentPort && !this.isMcpClaimRunning()) {
          BaishouServer.stopServer()
        }
      }
    }
    this.ownsHttpServer = false
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
    if (this.lanUploadFailedSub) {
      this.lanUploadFailedSub.remove()
      this.lanUploadFailedSub = null
    }
  }

  private async stopDiscoveryInternal(): Promise<void> {
    if (this.rescanTimer) {
      clearInterval(this.rescanTimer)
      this.rescanTimer = null
    }

    const wasActive = this.discoveryActive
    this.discoveryActive = false

    if (wasActive) {
      const impl = this.getAndroidDiscoveryImpl()
      if (impl) {
        this.zeroconf.stop(impl)
      } else {
        this.zeroconf.stop()
      }
      await this.mdnsSettle()
    }

    this.activeDevices.clear()
    this.serviceNameToDedupKey.clear()
    this.deviceFoundCb = undefined
    this.deviceLostCb = undefined
  }

  public async startDiscovery(
    onDeviceFound: (device: DiscoveredDevice) => void,
    onDeviceLost: (deviceId: string) => void
  ): Promise<void> {
    const granted = await ensureLanDiscoveryPermissions()
    if (!granted) {
      throw new Error(
        i18n.t(
          'auto.apps.mobile.src.services.lan.sync.service.L319',
          '需要授予附近设备或定位权限才能扫描局域网设备'
        )
      )
    }

    await this.enqueueMdns(
      async () => {
        await this.stopDiscoveryInternal()
        this.deviceFoundCb = onDeviceFound
        this.deviceLostCb = onDeviceLost
        this.activeDevices.clear()
        this.serviceNameToDedupKey.clear()
        this.discoveryActive = true
        this.scanLanServices()
        if (!this.shouldRestartDiscoveryScan()) return

        // NSD / iOS：启动后再主动扫一次，并周期全量 rescan
        setTimeout(() => {
          void this.enqueueMdns(() => {
            if (!this.discoveryActive) return
            this.scanLanServices()
          })
        }, 800)

        if (this.rescanTimer) clearInterval(this.rescanTimer)
        this.rescanTimer = setInterval(() => {
          void this.enqueueMdns(() => {
            if (!this.discoveryActive) return
            this.scanLanServices()
          })
        }, LAN_DISCOVERY_RESCAN_MS)
      },
      { propagateError: true }
    )
  }

  public async stopDiscovery(): Promise<void> {
    await this.enqueueMdns(async () => {
      await this.stopDiscoveryInternal()
    })
  }

  public async sendFile(
    ip: string,
    port: number,
    onProgress?: (percent: number) => void
  ): Promise<boolean> {
    return sendLanFile({
      archiveService: this.archiveService,
      fileSystem: this.fileSystem,
      ip,
      port,
      onProgress
    })
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

  public onLanUploadFailed(callback: (reason: string) => void): void {
    this.lanUploadFailedCallback = callback
  }
}
