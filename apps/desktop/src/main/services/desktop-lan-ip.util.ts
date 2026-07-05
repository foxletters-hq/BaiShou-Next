import * as os from 'os'
import { pickBestLanIpv4 } from '@baishou/shared'

/** 选取当前机器最合适的局域网 IPv4，供 MCP 等对外展示连接地址。 */
export function getDesktopLanIpv4(): string | null {
  const ifs = os.networkInterfaces()
  const candidates: string[] = []

  for (const name of Object.keys(ifs)) {
    for (const iface of ifs[name]!) {
      if (iface.family === 'IPv4' && !iface.internal) {
        candidates.push(iface.address)
      }
    }
  }

  return pickBestLanIpv4(candidates)
}
