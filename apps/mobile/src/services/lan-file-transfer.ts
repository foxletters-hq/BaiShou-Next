import { Platform } from 'react-native'
import * as BaishouServer from 'expo-baishou-server'
import type { IArchiveService, IFileSystem } from '@baishou/core-mobile'
import { isPrivateLanIpv4, pickBestLanIpv4 } from '@baishou/shared'
import { FileSystemUploadType, uploadAsync } from './mobile-http-transfer'
import { stripFileScheme } from './android-external-fs'

/** 在 mDNS 给出的多个候选地址中挑一个真正可连的（避免 VPN 地址拖慢传输） */
export async function findReachableLanIp(hostStr: string, port: number): Promise<string | null> {
  const hosts = [
    ...new Set(
      hostStr
        .split(',')
        .map((h) => h.trim())
        .filter(Boolean)
    )
  ]
  if (hosts.length === 0 || hosts[0] === 'Unknown') return null

  const results = await Promise.all(
    hosts.map(async (host) => {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 2_000)
      try {
        const response = await fetch(`http://${host}:${port}/info`, {
          signal: controller.signal
        })
        return { host, reachable: response.ok }
      } catch {
        return { host, reachable: false }
      } finally {
        clearTimeout(timer)
      }
    })
  )
  const reachable = results.find((item) => item.reachable)
  if (reachable) return reachable.host

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

/** 把档案 zip 推送到局域网对端，成功返回 true */
export async function sendLanFile(options: {
  archiveService: IArchiveService
  fileSystem: IFileSystem
  ip: string
  port: number
  onProgress?: (percent: number) => void
}): Promise<boolean> {
  const { archiveService, fileSystem, ip, port, onProgress } = options
  try {
    const reachableHost = await findReachableLanIp(ip, port)
    if (!reachableHost) {
      console.error('[MobileLanSyncService] no reachable LAN IP for', ip, port)
      return false
    }

    const zipPath = await archiveService.exportToTempFile()
    if (!zipPath) return false
    onProgress?.(1)

    const url = `http://${reachableHost}:${port}/upload`
    const nativeZipPath = stripFileScheme(zipPath)
    let progressSub: { remove: () => void } | null = null

    try {
      let status = 0
      if (Platform.OS === 'android' && BaishouServer.isLanUploadNativeAvailable()) {
        try {
          progressSub = BaishouServer.onLanSendProgress((event) => {
            if (event.totalBytes > 0) {
              onProgress?.(Math.min(99, Math.round((event.writtenBytes / event.totalBytes) * 100)))
            }
          })
        } catch {
          // 旧原生模块不声明该事件时不影响上传本身
          progressSub = null
        }
        const response = await BaishouServer.uploadLanFileAsync(url, nativeZipPath)
        status = response.status
      } else {
        const response = await uploadAsync(url, zipPath, {
          httpMethod: 'POST',
          uploadType: FileSystemUploadType.BINARY_CONTENT
        })
        status = response.status
      }

      if (status === 200) {
        onProgress?.(100)
        return true
      }
      return false
    } finally {
      progressSub?.remove()
      await fileSystem.unlink(zipPath).catch(() => {})
    }
  } catch (e) {
    console.error('[MobileLanSyncService] failed to push file', e)
    return false
  }
}
