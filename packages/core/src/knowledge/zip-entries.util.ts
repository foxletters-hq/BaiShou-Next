import { inflateRawSync } from 'node:zlib'

const SIG_EOCD = 0x06054b50
const SIG_CEN = 0x02014b50
const METHOD_STORE = 0
const METHOD_DEFLATE = 8

function u16(view: DataView, offset: number): number {
  return view.getUint16(offset, true)
}

function u32(view: DataView, offset: number): number {
  return view.getUint32(offset, true)
}

function findEocdOffset(buffer: Uint8Array): number {
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength)
  const min = Math.max(0, buffer.length - 22 - 0xffff)
  for (let i = buffer.length - 22; i >= min; i -= 1) {
    if (u32(view, i) === SIG_EOCD) return i
  }
  throw new Error('zip: missing end of central directory')
}

function decodeName(bytes: Uint8Array, utf8: boolean): string {
  if (utf8) return new TextDecoder('utf-8').decode(bytes)
  return Array.from(bytes, (code) => String.fromCharCode(code)).join('')
}

/**
 * 读取 ZIP 条目（仅支持 store / deflate，供 EPUB 解包）。
 */
export function readZipEntries(buffer: Uint8Array): Map<string, Uint8Array> {
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength)
  const eocd = findEocdOffset(buffer)
  const count = u16(view, eocd + 10)
  let cursor = u32(view, eocd + 16)
  const entries = new Map<string, Uint8Array>()

  for (let i = 0; i < count; i += 1) {
    if (u32(view, cursor) !== SIG_CEN) throw new Error('zip: invalid central directory')
    const flags = u16(view, cursor + 8)
    const method = u16(view, cursor + 10)
    const compressedSize = u32(view, cursor + 20)
    const nameLen = u16(view, cursor + 28)
    const extraLen = u16(view, cursor + 30)
    const commentLen = u16(view, cursor + 32)
    const localOffset = u32(view, cursor + 42)
    const nameBytes = buffer.subarray(cursor + 46, cursor + 46 + nameLen)
    const name = decodeName(nameBytes, Boolean(flags & 0x800))
    const localNameLen = u16(view, localOffset + 26)
    const localExtraLen = u16(view, localOffset + 28)
    const dataStart = localOffset + 30 + localNameLen + localExtraLen
    const compressed = buffer.subarray(dataStart, dataStart + compressedSize)
    cursor += 46 + nameLen + extraLen + commentLen
    if (name.endsWith('/')) continue
    if (method === METHOD_STORE) {
      entries.set(name, compressed)
      continue
    }
    if (method !== METHOD_DEFLATE) {
      throw new Error(`zip: unsupported compression ${method} for ${name}`)
    }
    entries.set(name, inflateRawSync(compressed))
  }
  return entries
}

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff
  for (let i = 0; i < data.length; i += 1) {
    crc ^= data[i]
    for (let bit = 0; bit < 8; bit += 1) {
      const mask = -(crc & 1)
      crc = (crc >>> 1) ^ (0xedb88320 & mask)
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}

function writeU16(target: Uint8Array, offset: number, value: number): void {
  target[offset] = value & 0xff
  target[offset + 1] = (value >>> 8) & 0xff
}

function writeU32(target: Uint8Array, offset: number, value: number): void {
  writeU16(target, offset, value)
  writeU16(target, offset + 2, value >>> 16)
}

/** 仅写入 store 条目，供测试构造 EPUB。 */
export function writeZipStore(entries: Array<{ name: string; data: Uint8Array }>): Uint8Array {
  const encoder = new TextEncoder()
  const locals: Uint8Array[] = []
  const centrals: Uint8Array[] = []
  let offset = 0
  for (const entry of entries) {
    const name = encoder.encode(entry.name)
    const crc = crc32(entry.data)
    const local = new Uint8Array(30 + name.length + entry.data.length)
    writeU32(local, 0, 0x04034b50)
    writeU16(local, 4, 20)
    writeU16(local, 6, 0x800)
    writeU16(local, 8, METHOD_STORE)
    writeU32(local, 14, crc)
    writeU32(local, 18, entry.data.length)
    writeU32(local, 22, entry.data.length)
    writeU16(local, 26, name.length)
    local.set(name, 30)
    local.set(entry.data, 30 + name.length)
    locals.push(local)

    const central = new Uint8Array(46 + name.length)
    writeU32(central, 0, 0x02014b50)
    writeU16(central, 4, 20)
    writeU16(central, 6, 20)
    writeU16(central, 8, 0x800)
    writeU16(central, 10, METHOD_STORE)
    writeU32(central, 16, crc)
    writeU32(central, 20, entry.data.length)
    writeU32(central, 24, entry.data.length)
    writeU16(central, 28, name.length)
    writeU32(central, 42, offset)
    central.set(name, 46)
    centrals.push(central)
    offset += local.length
  }

  const centralSize = centrals.reduce((sum, row) => sum + row.length, 0)
  const eocd = new Uint8Array(22)
  writeU32(eocd, 0, SIG_EOCD)
  writeU16(eocd, 8, entries.length)
  writeU16(eocd, 10, entries.length)
  writeU32(eocd, 12, centralSize)
  writeU32(eocd, 16, offset)

  const total = offset + centralSize + eocd.length
  const out = new Uint8Array(total)
  let cursor = 0
  for (const local of locals) {
    out.set(local, cursor)
    cursor += local.length
  }
  for (const central of centrals) {
    out.set(central, cursor)
    cursor += central.length
  }
  out.set(eocd, cursor)
  return out
}
