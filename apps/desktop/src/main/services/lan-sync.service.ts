import * as os from 'os'
import * as path from 'path'
import * as fs from 'fs'
import * as fsp from 'fs/promises'
import * as http from 'http'
import * as dgram from 'dgram'
import { app } from 'electron'
import express from 'express'
import { Bonjour, Browser } from 'bonjour-service'
import { v4 as uuidv4 } from 'uuid'

import { ILanSyncService, DiscoveredDevice, IArchiveService } from '@baishou/core'

export class DesktopLanSyncService implements ILanSyncService {
  private server: http.Server | null = null
  private bonjour: Bonjour | null = null
  private browser: Browser | null = null
  private publishedService: any = null
  private publishedServiceName: string | null = null

  private fileReceivedCallback?: (path: string) => void

  constructor(private archiveService: IArchiveService) {
    // Only used to generate archive zip internally for sending
  }

  private isExcludedIp(ip: string): boolean {
    const [a, b] = ip.split('.').map(Number)
    if (Number.isNaN(a) || Number.isNaN(b)) return true
    if (a === 127) return true
    if (a === 169 && b === 254) return true
    // RFC 2544 / Clash Meta TUN 等虚拟网段
    if (a === 198 && (b === 18 || b === 19)) return true
    return false
  }

  private isPrivateLanIp(ip: string): boolean {
    const [a, b] = ip.split('.').map(Number)
    if (a === 10) return true
    if (a === 172 && b >= 16 && b <= 31) return true
    if (a === 192 && b === 168) return true
    return false
  }

  private isVirtualInterface(name: string): boolean {
    const lower = name.toLowerCase()
    return [
      'clash',
      'meta',
      'tun',
      'wintun',
      'wireguard',
      'tailscale',
      'vpn',
      'virtual',
      'vethernet',
      'hyper-v',
      'npcap',
      'loopback'
    ].some((keyword) => lower.includes(keyword))
  }

  private scoreNetworkCandidate(address: string, ifaceName: string): number {
    if (this.isExcludedIp(address)) return -100
    if (this.isVirtualInterface(ifaceName)) return -50

    let score = 0
    if (this.isPrivateLanIp(address)) score += 100

    const lower = ifaceName.toLowerCase()
    if (lower.includes('wi-fi') || lower.includes('wlan') || lower.includes('wireless')) {
      score += 30
    }
    if (lower.includes('ethernet') || lower.includes('eth')) score += 20
    return score
  }

  private pickBestIp(candidates: string[]): string | null {
    const unique = Array.from(new Set(candidates.filter(Boolean)))
    if (unique.length === 0) return null

    const sorted = unique.sort((a, b) => {
      const scoreIp = (ip: string) => {
        if (this.isExcludedIp(ip)) return -100
        if (this.isPrivateLanIp(ip)) return 100
        return 0
      }
      return scoreIp(b) - scoreIp(a)
    })

    return sorted.find((ip) => !this.isExcludedIp(ip)) ?? sorted[0] ?? null
  }

  private getLocalIps(): string[] {
    const ifs = os.networkInterfaces()
    const candidates: { address: string; score: number }[] = []

    for (const name of Object.keys(ifs)) {
      for (const iface of ifs[name]!) {
        if (iface.family === 'IPv4' && !iface.internal) {
          candidates.push({
            address: iface.address,
            score: this.scoreNetworkCandidate(iface.address, name)
          })
        }
      }
    }

    return candidates
      .filter((item) => item.score > -100)
      .sort((a, b) => b.score - a.score)
      .map((item) => item.address)
  }

  private getOutboundIp(): Promise<string | null> {
    return new Promise((resolve) => {
      const socket = dgram.createSocket('udp4')
      socket.once('error', () => {
        socket.close()
        resolve(null)
      })
      socket.connect(53, '8.8.8.8', () => {
        const addr = socket.address()
        socket.close()
        resolve(typeof addr === 'object' ? addr.address : null)
      })
    })
  }

  private async getPreferredLocalIps(): Promise<string[]> {
    let ips = this.getLocalIps()
    if (ips.length === 0) {
      const outbound = await this.getOutboundIp()
      if (outbound && !this.isExcludedIp(outbound)) {
        ips = [outbound]
      }
    }
    return ips
  }

  public async startBroadcasting(): Promise<{
    ip: string
    port: number
    serviceId: string
    allIps: string[]
  } | null> {
    if (this.server) return null // already running

    const ips = await this.getPreferredLocalIps()
    if (ips.length === 0) throw new Error('No local network connection found')

    const displayIp = this.pickBestIp(ips)
    if (!displayIp) throw new Error('No usable local network connection found')

    const expressApp = express()

    // Endpoints
    expressApp.get('/info', (_req, res) => {
      // Return same schema as mobile and original expectation
      res.json({ nickname: os.userInfo().username || 'Desktop User' })
    })

    expressApp.post('/upload', (req, res) => {
      const fileName = `received_lan_${Date.now()}.zip`
      const tempPath = path.join(app.getPath('temp'), fileName)
      const writeStream = fs.createWriteStream(tempPath)

      req.pipe(writeStream)

      req.on('end', () => {
        // 网络请求结束，等待文件流彻底刷入磁盘
        writeStream.end()
      })

      writeStream.on('finish', () => {
        // 此时写入进程正式完成关停，并解除文件句柄占用，可安全进行解压
        if (this.fileReceivedCallback) {
          this.fileReceivedCallback(tempPath)
        }
        res.status(200).send('Success')
      })

      req.on('error', (err) => {
        console.error('Failed to receive LAN stream', err)
        res.status(500).send('Stream error')
      })
    })

    return new Promise((resolve, reject) => {
      // Listens on random open port 0
      this.server = expressApp.listen(0, '0.0.0.0', () => {
        const addr = this.server?.address()
        if (addr && typeof addr !== 'string') {
          const port = addr.port

          // Start mDNS
          try {
            this.bonjour = new Bonjour()

            const rawNickname = os.userInfo().username || 'Desktop'
            const safeNickname = rawNickname.replace(/[^\w\u4e00-\u9fa5]/g, '').substring(0, 10)
            const serviceName = `BaiShou-${safeNickname}-${uuidv4().substring(0, 4)}`
            this.publishedServiceName = serviceName

            this.publishedService = this.bonjour.publish({
              name: serviceName,
              type: 'baishou', // translates to _baishou._tcp
              protocol: 'tcp',
              port: port,
              txt: {
                nickname: safeNickname,
                ip: ips.slice(0, 4).join(','),
                device_type: 'desktop'
              }
            })
            resolve({ ip: displayIp, port, serviceId: serviceName, allIps: ips })
          } catch (e) {
            this.stopBroadcasting()
            reject(e)
          }
        } else {
          this.stopBroadcasting()
          reject(new Error('Failed to bind server address'))
        }
      })
    })
  }

  public async stopBroadcasting(): Promise<void> {
    if (this.publishedService) {
      this.publishedService.stop()
      this.publishedService = null
    }
    this.publishedServiceName = null
    if (this.bonjour) {
      this.bonjour.destroy()
      this.bonjour = null
    }
    if (this.server) {
      this.server.close()
      this.server = null
    }
  }

  public async startDiscovery(
    onDeviceFound: (device: DiscoveredDevice) => void,
    onDeviceLost: (deviceId: string) => void
  ): Promise<void> {
    await this.stopDiscovery()

    if (!this.bonjour) {
      this.bonjour = new Bonjour()
    }

    this.browser = this.bonjour.find({ type: 'baishou' }, (service) => {
      try {
        if (this.publishedServiceName && service.name === this.publishedServiceName) {
          return
        }

        const records = service.txt as any
        const txtIps = String(records?.ip || '')
          .split(',')
          .map((ip) => ip.trim())
          .filter(Boolean)
        const addressIps = (service.addresses || []).filter((addr) => !addr.includes(':'))
        const deviceIp =
          this.pickBestIp([...txtIps, ...addressIps]) || txtIps[0] || addressIps[0] || 'Unknown'

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

  public async stopDiscovery(): Promise<void> {
    if (this.browser) {
      this.browser.stop()
      this.browser = null
    }
    // We only destroy Bonjour if not broadcasting either
    if (!this.publishedService && this.bonjour) {
      this.bonjour.destroy()
      this.bonjour = null
    }
  }

  public async sendFile(
    ip: string,
    port: number,
    onProgress?: (percent: number) => void
  ): Promise<boolean> {
    return new Promise(async (resolve) => {
      try {
        const zipFile = await this.archiveService.exportToTempFile()
        if (!zipFile) {
          resolve(false)
          return
        }

        const stat = await fsp.stat(zipFile)
        const readStream = fs.createReadStream(zipFile)

        const options = {
          hostname: ip,
          port: port,
          path: '/upload',
          method: 'POST',
          headers: {
            'Content-Type': 'application/octet-stream',
            'Content-Length': stat.size,
            'Content-Disposition': `attachment; filename="${path.basename(zipFile)}"`
          }
        }

        const req = http.request(options, (res) => {
          let body = ''
          res.on('data', (d) => (body += d))
          res.on('end', () => {
            if (res.statusCode === 200) {
              resolve(true)
            } else {
              resolve(false)
            }
          })
        })

        req.on('error', (e) => {
          console.error('[DesktopLanSyncService] POST error: ', e)
          resolve(false)
        })

        if (onProgress) {
          let uploaded = 0
          readStream.on('data', (chunk) => {
            uploaded += chunk.length
            onProgress(Math.min(100, Math.round((uploaded / stat.size) * 100)))
          })
        }

        readStream.pipe(req)
      } catch (e) {
        console.error('[DesktopLanSyncService] failed to send file', e)
        resolve(false)
      }
    })
  }

  public onFileReceived(callback: (zipFilePath: string) => void): void {
    this.fileReceivedCallback = callback
  }
}
