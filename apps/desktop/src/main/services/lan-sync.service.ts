import * as os from 'os'
import * as path from 'path'
import * as fs from 'fs'
import * as fsp from 'fs/promises'
import * as http from 'http'
import * as dgram from 'dgram'
import { app } from 'electron'
import express from 'express'

import { ILanSyncService, DiscoveredDevice, IArchiveService } from '@baishou/core-desktop'
import { buildLanServiceName, pickBestLanIpv4, isPrivateLanIpv4 } from '@baishou/shared'
import { LanDiscovery } from './LanDiscovery'
import { getDesktopInstallInstanceId } from './install-instance.service'

export class DesktopLanSyncService implements ILanSyncService {
  private server: http.Server | null = null
  private discovery: LanDiscovery = new LanDiscovery()
  private publishedServiceName: string | null = null
  private lanDeviceId: string | null = null
  private fileReceivedCallback?: (path: string) => void

  constructor(private archiveService: IArchiveService) {}

  private async getLanDeviceId(): Promise<string> {
    if (!this.lanDeviceId) {
      this.lanDeviceId = await getDesktopInstallInstanceId()
    }
    return this.lanDeviceId
  }

  private isExcludedIp(ip: string): boolean {
    const [a, b] = ip.split('.').map(Number)
    if (Number.isNaN(a) || Number.isNaN(b)) return true
    if (a === 127) return true
    if (a === 169 && b === 254) return true
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
    return pickBestLanIpv4(candidates)
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
      // 与原版 Flutter 一致：过滤失败时回退到所有非回环 IPv4
      const ifs = os.networkInterfaces()
      const fallback: string[] = []
      for (const name of Object.keys(ifs)) {
        for (const iface of ifs[name]!) {
          if (iface.family === 'IPv4' && !iface.internal && iface.address !== '127.0.0.1') {
            fallback.push(iface.address)
          }
        }
      }
      ips = fallback
    }
    if (ips.length === 0) {
      const outbound = await this.getOutboundIp()
      if (outbound && !this.isExcludedIp(outbound)) {
        ips = [outbound]
      }
    }
    return ips
  }

  private async publishService(port: number, ips: string[]): Promise<string> {
    const deviceId = await this.getLanDeviceId()
    const rawNickname = os.userInfo().username || 'Desktop'
    const safeNickname = rawNickname.replace(/[^\w\u4e00-\u9fa5]/g, '').substring(0, 10)
    const serviceName = buildLanServiceName(safeNickname, deviceId)
    this.publishedServiceName = serviceName

    this.discovery.publish(serviceName, port, {
      nickname: safeNickname,
      ip: ips.slice(0, 4).join(','),
      device_type: 'desktop',
      device_id: deviceId
    })

    return serviceName
  }

  public async startBroadcasting(): Promise<{
    ip: string
    port: number
    serviceId: string
    allIps: string[]
    deviceId: string
  } | null> {
    const deviceId = await this.getLanDeviceId()

    if (this.server) {
      const addr = this.server.address()
      if (addr && typeof addr !== 'string') {
        const ips = await this.getPreferredLocalIps()
        const displayIp = this.pickBestIp(ips) || ips[0]
        if (!displayIp) return null

        if (!this.discovery.hasPublishedService()) {
          const serviceName = await this.publishService(addr.port, ips)
          return {
            ip: displayIp,
            port: addr.port,
            serviceId: serviceName,
            allIps: ips,
            deviceId
          }
        }

        return {
          ip: displayIp,
          port: addr.port,
          serviceId: this.publishedServiceName || `BaiShou-${displayIp}-${addr.port}`,
          allIps: ips,
          deviceId
        }
      }
      return null
    }

    const ips = await this.getPreferredLocalIps()
    if (ips.length === 0) throw new Error('No local network connection found')

    const displayIp = this.pickBestIp(ips)
    if (!displayIp) throw new Error('No usable local network connection found')

    const expressApp = express()

    expressApp.get('/info', (_req, res) => {
      res.json({ nickname: os.userInfo().username || 'Desktop User' })
    })

    expressApp.post('/upload', (req, res) => {
      const fileName = `received_lan_${Date.now()}.zip`
      const tempPath = path.join(app.getPath('temp'), fileName)
      const writeStream = fs.createWriteStream(tempPath)

      writeStream.on('finish', () => {
        if (this.fileReceivedCallback) {
          this.fileReceivedCallback(tempPath)
        }
        res.status(200).send('Success')
      })

      writeStream.on('error', (err) => {
        console.error('Failed to write LAN upload', err)
        if (!res.headersSent) {
          res.status(500).send('Write error')
        }
      })

      req.on('error', (err) => {
        console.error('Failed to receive LAN stream', err)
        writeStream.destroy()
        if (!res.headersSent) {
          res.status(500).send('Stream error')
        }
      })

      req.pipe(writeStream)
    })

    return new Promise((resolve, reject) => {
      this.server = expressApp.listen(0, '0.0.0.0', () => {
        const addr = this.server?.address()
        if (addr && typeof addr !== 'string') {
          const port = addr.port

          try {
            void this.publishService(port, ips)
              .then((serviceName) => {
                resolve({ ip: displayIp, port, serviceId: serviceName, allIps: ips, deviceId })
              })
              .catch((e) => {
                this.stopBroadcasting()
                reject(e)
              })
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
    this.discovery.unpublish()
    this.publishedServiceName = null
    this.discovery.destroy()
    this.discovery = new LanDiscovery()
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
    this.discovery.startDiscovery(this.publishedServiceName, onDeviceFound, onDeviceLost)
  }

  public async stopDiscovery(): Promise<void> {
    this.discovery.stopDiscovery()
    if (!this.discovery.hasPublishedService()) {
      this.discovery.destroy()
      this.discovery = new LanDiscovery()
    }
  }

  private probeInfo(host: string, port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const req = http.get(
        { hostname: host, port, path: '/info', timeout: 3000 },
        (res) => {
          res.resume()
          resolve(res.statusCode === 200)
        }
      )
      req.on('error', () => resolve(false))
      req.on('timeout', () => {
        req.destroy()
        resolve(false)
      })
    })
  }

  private async findReachableIp(hostStr: string, port: number): Promise<string | null> {
    const hosts = hostStr
      .split(',')
      .map((h) => h.trim())
      .filter(Boolean)
    if (hosts.length === 0 || hosts[0] === 'Unknown') return null

    for (const host of hosts) {
      if (await this.probeInfo(host, port)) return host
    }

    const fallback = pickBestLanIpv4(hosts)
    if (fallback && isPrivateLanIpv4(fallback)) {
      console.warn(
        '[DesktopLanSyncService] /info probe failed, fallback to direct LAN IP',
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
    let zipFile: string | null = null
    try {
      const reachableHost = await this.findReachableIp(ip, port)
      if (!reachableHost) {
        console.error('[DesktopLanSyncService] no reachable LAN IP for', ip, port)
        return false
      }

      zipFile = await this.archiveService.exportToTempFile()
      if (!zipFile) return false

      const stat = await fsp.stat(zipFile)
      const readStream = fs.createReadStream(zipFile)

      return await new Promise<boolean>((resolve) => {
        let settled = false
        let responseStatus: number | null = null
        let bodyFullySent = false
        let uploadedBytes = 0

        const finish = (ok: boolean) => {
          if (settled) return
          settled = true
          resolve(ok)
        }

        const finishIfAlreadyOk = () => {
          if (responseStatus === 200) {
            onProgress?.(100)
            finish(true)
            return true
          }
          return false
        }

        const finishIfUploadCompleteAfterAbort = (reason: string) => {
          if (!bodyFullySent || uploadedBytes < stat.size) return false
          console.warn(`[DesktopLanSyncService] ${reason}; upload complete, treating as success`)
          onProgress?.(100)
          finish(true)
          return true
        }

        const handlePostSocketError = (e: unknown) => {
          if (finishIfAlreadyOk()) return
          const code = (e as NodeJS.ErrnoException)?.code
          const message = e instanceof Error ? e.message : String(e)
          if (
            code === 'ECONNRESET' ||
            code === 'EPIPE' ||
            message.includes('socket hang up')
          ) {
            if (finishIfUploadCompleteAfterAbort('Connection closed after upload')) return
          }
          console.error('[DesktopLanSyncService] POST error:', e)
          finish(false)
        }

        const req = http.request(
          {
            hostname: reachableHost,
            port,
            path: '/upload',
            method: 'POST',
            headers: {
              'Content-Type': 'application/octet-stream',
              'Content-Length': stat.size,
              'Content-Disposition': `attachment; filename="${path.basename(zipFile!)}"`,
              Connection: 'close'
            }
          },
          (res) => {
            responseStatus = res.statusCode ?? null
            res.resume()
            res.on('end', () => {
              onProgress?.(100)
              finish(res.statusCode === 200)
            })
            res.on('error', (e) => {
              console.error('[DesktopLanSyncService] response error:', e)
              if (!finishIfAlreadyOk()) finish(false)
            })
          }
        )

        req.setTimeout(15 * 60 * 1000, () => {
          console.error('[DesktopLanSyncService] POST timed out waiting for device response')
          req.destroy()
          if (!finishIfAlreadyOk() && !finishIfUploadCompleteAfterAbort('POST timed out after upload')) {
            finish(false)
          }
        })

        req.on('finish', () => {
          bodyFullySent = true
        })

        req.on('error', handlePostSocketError)

        req.on('close', () => {
          if (settled) return
          if (finishIfAlreadyOk()) return
          finishIfUploadCompleteAfterAbort('Connection closed without HTTP response')
        })

        readStream.on('error', (e) => {
          console.error('[DesktopLanSyncService] read stream error:', e)
          finish(false)
        })

        readStream.on('data', (chunk: Buffer | string) => {
          uploadedBytes += Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(chunk)
          if (onProgress) {
            const pct = Math.min(99, Math.round((uploadedBytes / stat.size) * 100))
            onProgress(pct)
          }
        })

        readStream.pipe(req)
      })
    } catch (e) {
      console.error('[DesktopLanSyncService] failed to send file', e)
      return false
    } finally {
      if (zipFile) {
        await fsp.unlink(zipFile).catch(() => {})
      }
    }
  }

  public onFileReceived(callback: (zipFilePath: string) => void): void {
    this.fileReceivedCallback = callback
  }
}
