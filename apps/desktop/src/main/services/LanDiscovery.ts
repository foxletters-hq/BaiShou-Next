import { Bonjour, Browser } from 'bonjour-service'
import { DiscoveredDevice } from '@baishou/core'

/**
 * 负责局域网 mDNS (Bonjour) 服务的广播发布与局域网伙伴嗅探发现。
 */
export class LanDiscovery {
  private bonjour: Bonjour | null = null
  private browser: Browser | null = null
  private publishedService: any = null

  private getBonjour(): Bonjour {
    if (!this.bonjour) {
      this.bonjour = new Bonjour()
    }
    return this.bonjour
  }

  public publish(name: string, port: number, txt: any) {
    const bj = this.getBonjour()
    this.publishedService = bj.publish({
      name,
      type: 'baishou',
      protocol: 'tcp',
      port,
      txt
    })
    return this.publishedService
  }

  public unpublish() {
    if (this.publishedService) {
      this.publishedService.stop()
      this.publishedService = null
    }
  }

  public startDiscovery(
    publishedServiceName: string | null,
    pickBestIp: (candidates: string[]) => string | null,
    onDeviceFound: (device: DiscoveredDevice) => void,
    onDeviceLost: (deviceId: string) => void
  ) {
    const bj = this.getBonjour()
    this.browser = bj.find({ type: 'baishou' }, (service) => {
      try {
        if (publishedServiceName && service.name === publishedServiceName) {
          return
        }

        const records = service.txt as any
        const txtIps = String(records?.ip || '')
          .split(',')
          .map((ip) => ip.trim())
          .filter(Boolean)
        const addressIps = (service.addresses || []).filter((addr) => !addr.includes(':'))
        const deviceIp =
          pickBestIp([...txtIps, ...addressIps]) || txtIps[0] || addressIps[0] || 'Unknown'

        const device: DiscoveredDevice = {
          nickname: records?.nickname || service.name,
          ip: deviceIp,
          port: service.port,
          deviceType: records?.device_type || 'other',
          rawServiceId: service.name
        }
        onDeviceFound(device)
      } catch (e) {
        console.error('Failed to parse mDNS txt string', e)
      }
    })

    this.browser.on('down', (service) => {
      onDeviceLost(service.name)
    })
  }

  public stopDiscovery() {
    if (this.browser) {
      this.browser.stop()
      this.browser = null
    }
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
