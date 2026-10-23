import { protocol } from 'electron'
import { join } from 'path'
import { open, stat } from 'node:fs/promises'
import { createReadStream, existsSync } from 'node:fs'
import { Readable } from 'node:stream'
import {
  localFileContentType,
  localProtocolEmojiRelativePath,
  localProtocolFileResponseHeaders,
  localProtocolUrlToFilePath,
  parseByteRangeHeader
} from './local-protocol.util'

/** 必须在 app ready 之前调用 */
export function registerLocalProtocolScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'local',
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
        stream: true
      }
    }
  ])
}

function applyLocalProtocolCors(headers: Headers): Headers {
  headers.set('Access-Control-Allow-Origin', '*')
  headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS')
  headers.set('Access-Control-Allow-Headers', '*')
  headers.set(
    'Access-Control-Expose-Headers',
    'Accept-Ranges, Content-Range, Content-Length, Content-Type'
  )
  return headers
}

function localProtocolResponse(body: BodyInit | null, init?: ResponseInit): Response {
  const headers = applyLocalProtocolCors(new Headers(init?.headers))
  return new Response(body, { ...init, headers })
}

async function serveLocalPhysicalFile(request: Request, physicalPath: string): Promise<Response> {
  const contentType = localFileContentType(physicalPath)
  const fileStat = await stat(physicalPath)
  const size = fileStat.size
  if (request.method === 'HEAD') {
    const meta = localProtocolFileResponseHeaders({ contentType, size })
    return localProtocolResponse(null, { status: meta.status, headers: meta.headers })
  }
  const rangeResult = parseByteRangeHeader(request.headers.get('Range'), size)
  if (rangeResult === 'unsatisfiable') {
    return localProtocolResponse(null, {
      status: 416,
      headers: {
        'Content-Range': `bytes */${size}`,
        'Accept-Ranges': 'bytes'
      }
    })
  }
  if (rangeResult) {
    const meta = localProtocolFileResponseHeaders({ contentType, size, range: rangeResult })
    const length = rangeResult.end - rangeResult.start + 1
    const handle = await open(physicalPath, 'r')
    try {
      const buf = Buffer.allocUnsafe(length)
      const { bytesRead } = await handle.read(buf, 0, length, rangeResult.start)
      const body = bytesRead === length ? buf : buf.subarray(0, bytesRead)
      return localProtocolResponse(body, { status: meta.status, headers: meta.headers })
    } finally {
      await handle.close()
    }
  }
  const meta = localProtocolFileResponseHeaders({ contentType, size })
  if (size === 0) {
    return localProtocolResponse(new Uint8Array(), { status: 200, headers: meta.headers })
  }
  return localProtocolResponse(Readable.toWeb(createReadStream(physicalPath)) as ReadableStream, {
    status: 200,
    headers: meta.headers
  })
}

export function registerLocalProtocolHandler(): void {
  protocol.handle('local', async (request) => {
    try {
      if (request.method === 'OPTIONS') {
        return localProtocolResponse(null, { status: 204 })
      }
      const emojiRel = localProtocolEmojiRelativePath(request.url)
      let physicalPath: string
      if (emojiRel) {
        const { DesktopStoragePathService } = await import('./services/path.service')
        const pathService = new DesktopStoragePathService()
        const emojisDir = await pathService.getEmojisDirectory()
        physicalPath = join(emojisDir, emojiRel)
      } else {
        physicalPath = localProtocolUrlToFilePath(request.url)
      }
      if (!existsSync(physicalPath)) {
        return localProtocolResponse('Not found', { status: 404 })
      }
      return serveLocalPhysicalFile(request, physicalPath)
    } catch {
      // 资源失效（如已删除的头像）时安静返回 404，避免 ERR_FILE_NOT_FOUND 堆栈
      return localProtocolResponse('Not found', { status: 404 })
    }
  })
}
