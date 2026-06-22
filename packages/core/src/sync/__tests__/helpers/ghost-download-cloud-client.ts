import { InMemoryIncrementalCloudClient } from './shared-cloud-store'

function normalizeKey(relativePath: string): string {
  return relativePath.replace(/\\/g, '/')
}

/**
 * 列表中仍可见、但下载时返回 404 的云端客户端。
 * 模拟 S3/WebDAV 列表与 GET 短暂不一致的场景。
 */
export class GhostDownloadCloudClient extends InMemoryIncrementalCloudClient {
  private readonly ghostDownloadPaths = new Set<string>()

  markGhostDownload(relativePath: string): void {
    this.ghostDownloadPaths.add(normalizeKey(relativePath))
  }

  override async downloadFile(remoteFilename: string, localDestPath: string): Promise<void> {
    const key = normalizeKey(remoteFilename)
    if (this.ghostDownloadPaths.has(key)) {
      const err = new Error(`Not Found: ${remoteFilename}`) as Error & {
        statusCode?: number
        code?: string
      }
      err.statusCode = 404
      err.code = 'NotFound'
      throw err
    }
    return super.downloadFile(remoteFilename, localDestPath)
  }
}
