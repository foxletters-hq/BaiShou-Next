/**
 * 解析 `adb devices` 并选出要操作的那一台。
 * USB + 无线同时在线时（同一部手机很常见）必须带 -s，否则会报 more than one device。
 */

export function isTcpAdbSerial(serial) {
  return typeof serial === 'string' && serial.includes(':')
}

export function isEmulatorSerial(serial) {
  return typeof serial === 'string' && serial.startsWith('emulator-')
}

export function parseAdbDevices(output) {
  const devices = []
  if (!output) return devices
  for (const line of output.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('List of')) continue
    const parts = trimmed.split(/\s+/)
    if (parts.length < 2) continue
    devices.push({ serial: parts[0], state: parts[1] })
  }
  return devices
}

/**
 * 在线设备里挑一台：已指定序列号 > USB 真机 > 无线 adb > 模拟器。
 */
export function pickAdbSerial(devices, preferredSerial) {
  const online = (devices || []).filter((d) => d?.state === 'device' && d.serial)
  if (online.length === 0) return null

  if (preferredSerial) {
    const match = online.find((d) => d.serial === preferredSerial)
    if (match) return match.serial
  }

  const usb = online.find((d) => !isTcpAdbSerial(d.serial) && !isEmulatorSerial(d.serial))
  if (usb) return usb.serial

  const tcp = online.find((d) => isTcpAdbSerial(d.serial))
  if (tcp) return tcp.serial

  return online[0].serial
}

export function withAdbSerialArgs(args, serial) {
  const list = Array.isArray(args) ? args : []
  return serial ? ['-s', serial, ...list] : list
}

export function formatAdbShellCommand(serial, rest) {
  const prefix = serial ? `adb -s ${serial}` : 'adb'
  return `${prefix} ${rest}`
}

/** 输错 IP 的无线 adb 会留下 offline 条目，adb 仍会报 more than one device */
export function listOfflineTcpSerials(devices) {
  return (devices || [])
    .filter((d) => d?.state === 'offline' && isTcpAdbSerial(d.serial))
    .map((d) => d.serial)
}
