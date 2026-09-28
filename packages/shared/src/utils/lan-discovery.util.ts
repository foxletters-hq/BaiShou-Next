export const LAN_DEVICE_STALE_MS = 120_000
/** 移动端 zeroconf 全量 rescan 间隔 */
export const LAN_DISCOVERY_RESCAN_MS = 30_000
/** 桌面端 bonjour browser.update() 主动 re-query 间隔（Windows 被动发现 Android 很慢） */
export const LAN_DISCOVERY_REQUERY_MS = 5_000

export type LanDeviceType = 'mobile' | 'desktop' | 'other'

export interface LanDiscoveredDeviceLike {
  deviceId?: string
  nickname: string
  ip: string
  port: number
  deviceType?: string
  rawServiceId: string
}

function readLanTxtValue(
  records: Record<string, unknown> | null | undefined,
  ...keys: string[]
): string {
  if (!records) return ''
  for (const key of keys) {
    const raw = records[key]
    if (raw == null) continue
    // bonjour-service 偶发给出 Buffer；String(buffer) 可用，需排除空对象
    const value = typeof raw === 'string' ? raw : String(raw)
    const trimmed = value.trim()
    if (trimmed && trimmed !== '[object Object]') return trimmed
  }
  return ''
}

/**
 * 从 TXT / deviceId 前缀 / 昵称推断设备类型。
 * TXT 未解析完或跨栈丢失时，避免把手机误判成桌面。
 */
export function normalizeLanDeviceType(options: {
  txt?: Record<string, unknown> | null
  deviceId?: string
  nickname?: string
  deviceType?: string
}): LanDeviceType {
  const candidates = [
    String(options.deviceType ?? '').trim(),
    readLanTxtValue(options.txt, 'device_type', 'deviceType', 'dtype')
  ]
  for (const raw of candidates) {
    const value = raw.toLowerCase()
    if (value === 'mobile' || value === 'desktop') return value
  }

  const deviceId = String(options.deviceId ?? readLanTxtValue(options.txt, 'device_id', 'deviceId'))
    .trim()
    .toLowerCase()
  if (deviceId.startsWith('mobile-')) return 'mobile'
  if (deviceId.startsWith('desktop-')) return 'desktop'

  const nickname = String(
    options.nickname ?? readLanTxtValue(options.txt, 'nickname')
  ).toLowerCase()
  if (
    nickname.includes('baishoumob') ||
    nickname.includes('iphone') ||
    nickname.includes('android') ||
    /\bphone\b/.test(nickname)
  ) {
    return 'mobile'
  }
  if (nickname.includes('macbook') || nickname.includes('desktop') || nickname.includes('pc')) {
    return 'desktop'
  }

  return 'other'
}

function isIpv4(ip: string): boolean {
  const parts = ip.split('.')
  if (parts.length !== 4) return false
  return parts.every((part) => {
    const n = Number(part)
    return Number.isInteger(n) && n >= 0 && n <= 255
  })
}

export function isPrivateLanIpv4(ip: string): boolean {
  if (!isIpv4(ip)) return false
  const octets = ip.split('.').map(Number)
  const a = octets[0]
  const b = octets[1]
  if (a === undefined || b === undefined) return false
  if (a === 10) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  return false
}

export function isExcludedLanIpv4(ip: string): boolean {
  if (!isIpv4(ip)) return true
  const octets = ip.split('.').map(Number)
  const a = octets[0]
  const b = octets[1]
  if (a === undefined || b === undefined) return true
  if (a === 169 && b === 254) return true
  if (a === 198 && (b === 18 || b === 19)) return true
  return false
}

/** Docker / WSL / Hyper-V / VPN 等虚拟网卡，不宜作为对外 MCP / 局域网展示地址 */
export function isVirtualLanInterfaceName(name: string): boolean {
  const lower = name.toLowerCase()
  return [
    'docker',
    'veth',
    'br-',
    'wsl',
    'hyper-v',
    'vethernet',
    'vmware',
    'virtualbox',
    'vbox',
    'clash',
    'meta',
    'tun',
    'wintun',
    'wireguard',
    'tailscale',
    'vpn',
    'virtual',
    'npcap',
    'loopback'
  ].some((keyword) => lower.includes(keyword))
}

export function pickBestLanIpv4(candidates: string[]): string | null {
  const unique = Array.from(new Set(candidates.map((ip) => ip.trim()).filter(Boolean)))
  if (unique.length === 0) return null

  const score = (ip: string) => {
    if (isExcludedLanIpv4(ip)) return -100
    if (!isIpv4(ip)) return -50
    const octets = ip.split('.').map(Number)
    const a = octets[0]
    const b = octets[1]
    // 家用/常见 Wi-Fi 优先；172.16/12 常被 Docker、WSL、Hyper-V 占用
    if (a === 192 && b === 168) return 130
    if (a === 10) return 120
    if (a === 172 && b !== undefined && b >= 16 && b <= 31) return 90
    if (isPrivateLanIpv4(ip)) return 100
    return 10
  }

  const sorted = [...unique].sort((a, b) => score(b) - score(a) || a.localeCompare(b))
  return sorted.find((ip) => score(ip) > -50) ?? sorted[0] ?? null
}

export function parseLanTxtIpv4(txt?: Record<string, unknown> | null): string | null {
  const raw = String(txt?.ip ?? '')
    .split(',')
    .map((ip) => ip.trim())
    .filter(Boolean)
  return pickBestLanIpv4(raw)
}

export function resolveDiscoveredLanIpv4(options: {
  txt?: Record<string, unknown> | null
  addresses?: string[]
  host?: string
}): string {
  const fromTxt = parseLanTxtIpv4(options.txt)
  if (fromTxt) return fromTxt

  const fromAddresses = pickBestLanIpv4(
    (options.addresses ?? []).filter((addr) => !addr.includes(':'))
  )
  if (fromAddresses) return fromAddresses

  const host = String(options.host ?? '').trim()
  if (host && isIpv4(host)) return host

  return 'Unknown'
}

export function getLanDeviceHostKey(device: LanDiscoveredDeviceLike): string | null {
  const ip = device.ip?.trim()
  const deviceType = device.deviceType?.trim()
  if (!ip || ip === 'Unknown' || !deviceType || deviceType === 'other') return null
  return `host:${deviceType}:${ip}`
}

function isStableLanDeviceId(deviceId: string | undefined, rawServiceId: string): boolean {
  const id = deviceId?.trim()
  if (!id) return false
  if (id === rawServiceId) return false
  if (id.startsWith('BaiShou-')) return false
  return true
}

export function getLanDeviceDedupKey(device: LanDiscoveredDeviceLike): string {
  if (isStableLanDeviceId(device.deviceId, device.rawServiceId)) {
    return `id:${device.deviceId!.trim()}`
  }

  const hostKey = getLanDeviceHostKey(device)
  if (hostKey) return hostKey

  if (device.ip && device.ip !== 'Unknown' && device.port > 0) {
    return `ep:${device.ip}:${device.port}`
  }
  return `svc:${device.rawServiceId}`
}

export function lanDevicesEquivalent(
  a: LanDiscoveredDeviceLike,
  b: LanDiscoveredDeviceLike
): boolean {
  return (
    getLanDeviceDedupKey(a) === getLanDeviceDedupKey(b) &&
    a.nickname === b.nickname &&
    a.ip === b.ip &&
    a.port === b.port &&
    a.deviceType === b.deviceType
  )
}

export function upsertDiscoveredLanDevice<T extends LanDiscoveredDeviceLike>(
  devices: T[],
  incoming: T
): T[] {
  const incomingKey = getLanDeviceDedupKey(incoming)
  const incomingHostKey = getLanDeviceHostKey(incoming)

  const filtered = devices.filter((device) => {
    if (getLanDeviceDedupKey(device) === incomingKey) return false
    if (incomingHostKey && getLanDeviceHostKey(device) === incomingHostKey) return false
    return true
  })

  return [...filtered, incoming]
}

export function removeDiscoveredLanDevice<T extends LanDiscoveredDeviceLike>(
  devices: T[],
  lostId: string
): T[] {
  const trimmed = lostId.trim()
  if (!trimmed) return devices
  return devices.filter(
    (device) =>
      device.rawServiceId !== trimmed &&
      device.deviceId !== trimmed &&
      getLanDeviceDedupKey(device) !== trimmed
  )
}

export function buildLanServiceName(nickname: string, deviceId: string): string {
  const safeNickname = nickname.replace(/[^\w\u4e00-\u9fa5]/g, '').substring(0, 10) || 'Device'
  const suffix = deviceId.replace(/[^a-zA-Z0-9]/g, '').slice(-8) || 'lan'
  return `BaiShou-${safeNickname}-${suffix}`
}

/** 与原版 Flutter 一致：局域网备份包大小（MB，保留两位小数） */
export function formatLanBackupSizeMb(sizeBytes: number): string {
  if (!Number.isFinite(sizeBytes) || sizeBytes < 0) return '?'
  return (sizeBytes / (1024 * 1024)).toFixed(2)
}

/** i18n 文案使用 $size 占位符，需手动替换（与项目其它 $count 等一致） */
export function formatLanReceivedBackupContent(message: string, sizeBytes: number): string {
  return message.replace('$size', formatLanBackupSizeMb(sizeBytes))
}
