const SIG_EOCD = 0x06054b50
const SIG_CEN = 0x02014b50
const METHOD_STORE = 0
const METHOD_DEFLATE = 8

export const DEFAULT_ZIP_MAX_ENTRY_BYTES = 16 * 1024 * 1024
export const DEFAULT_ZIP_MAX_TOTAL_BYTES = 32 * 1024 * 1024
export const DEFAULT_ZIP_MAX_ENTRIES = 2000

const CL_ORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]

const LENGTH_BASE = [
  3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131,
  163, 195, 227, 258
]
const LENGTH_EXTRA = [
  0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0
]
const DIST_BASE = [
  1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049,
  3073, 4097, 6145, 8193, 12289, 16385, 24577
]
const DIST_EXTRA = [
  0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13
]

type HuffmanTable = {
  counts: Uint16Array
  symbols: Uint16Array
  maxBits: number
}

function buildHuffmanTable(lengths: Uint8Array): HuffmanTable {
  let maxBits = 0
  for (let i = 0; i < lengths.length; i++) {
    const len = lengths[i] ?? 0
    if (len > maxBits) maxBits = len
  }
  if (maxBits === 0) {
    return { counts: new Uint16Array(16), symbols: new Uint16Array(0), maxBits: 0 }
  }
  const counts = new Uint16Array(maxBits + 1)
  for (let i = 0; i < lengths.length; i++) {
    const len = lengths[i] ?? 0
    if (len > 0) counts[len] = (counts[len] ?? 0) + 1
  }
  const offsets = new Uint16Array(maxBits + 1)
  let total = 0
  for (let bits = 1; bits <= maxBits; bits++) {
    offsets[bits] = total
    total += counts[bits] ?? 0
  }
  const symbols = new Uint16Array(total)
  for (let sym = 0; sym < lengths.length; sym++) {
    const len = lengths[sym] ?? 0
    if (len > 0) {
      const idx = offsets[len] ?? 0
      symbols[idx] = sym
      offsets[len] = idx + 1
    }
  }
  return { counts, symbols, maxBits }
}

const FIXED_LIT_LENGTHS = (() => {
  const arr = new Uint8Array(288)
  arr.fill(8, 0, 144)
  arr.fill(9, 144, 256)
  arr.fill(7, 256, 280)
  arr.fill(8, 280, 288)
  return arr
})()

const FIXED_DIST_LENGTHS = (() => {
  const arr = new Uint8Array(32)
  arr.fill(5)
  return arr
})()

const FIXED_LIT_TABLE = buildHuffmanTable(FIXED_LIT_LENGTHS)
const FIXED_DIST_TABLE = buildHuffmanTable(FIXED_DIST_LENGTHS)

/**
 * 纯 TypeScript 实现的 RFC 1951 Deflate Raw 解压（跨 Node / Electron / React Native 通用），
 * 内置最大解压字节数上限保护，防止 Zip Bomb 撑爆内存。
 */
export function inflateRaw(
  compressed: Uint8Array,
  maxOutputBytes = DEFAULT_ZIP_MAX_ENTRY_BYTES
): Uint8Array {
  let bitPos = 0
  const totalBits = compressed.length * 8

  const readBits = (n: number): number => {
    if (n === 0) return 0
    if (bitPos + n > totalBits) {
      throw new Error('zip: unexpected end of deflate stream')
    }
    let val = 0
    for (let i = 0; i < n; i++) {
      const byteIdx = (bitPos + i) >>> 3
      const bitIdx = (bitPos + i) & 7
      val |= (((compressed[byteIdx] ?? 0) >>> bitIdx) & 1) << i
    }
    bitPos += n
    return val
  }

  const decodeSymbol = (table: HuffmanTable): number => {
    let code = 0
    let first = 0
    let index = 0
    for (let len = 1; len <= table.maxBits; len++) {
      code |= readBits(1)
      const count = table.counts[len] ?? 0
      if (code - count < first) {
        return table.symbols[index + (code - first)] ?? 0
      }
      index += count
      first = (first + count) << 1
      code <<= 1
    }
    throw new Error('zip: invalid Huffman code in deflate stream')
  }

  let out = new Uint8Array(Math.min(Math.max(compressed.length * 3, 256), maxOutputBytes))
  let outPos = 0

  const ensureCapacity = (needed: number): void => {
    if (outPos + needed > maxOutputBytes) {
      throw new Error(`zip: inflated entry exceeds limit (${maxOutputBytes} bytes)`)
    }
    if (outPos + needed <= out.length) return
    let nextLen = Math.max(out.length * 2, outPos + needed)
    if (nextLen > maxOutputBytes) nextLen = maxOutputBytes
    const next = new Uint8Array(nextLen)
    next.set(out.subarray(0, outPos))
    out = next
  }

  let isFinal = 0
  while (!isFinal) {
    isFinal = readBits(1)
    const btype = readBits(2)

    if (btype === 0) {
      // Uncompressed block: align to next byte boundary
      bitPos = (bitPos + 7) & ~7
      const bytePos = bitPos >>> 3
      if (bytePos + 4 > compressed.length) {
        throw new Error('zip: truncated uncompressed deflate block')
      }
      const len = (compressed[bytePos] ?? 0) | ((compressed[bytePos + 1] ?? 0) << 8)
      const nlen = (compressed[bytePos + 2] ?? 0) | ((compressed[bytePos + 3] ?? 0) << 8)
      if ((len ^ 0xffff) !== nlen) {
        throw new Error('zip: invalid uncompressed block length complement')
      }
      bitPos = (bytePos + 4) * 8
      if (bytePos + 4 + len > compressed.length) {
        throw new Error('zip: truncated uncompressed block payload')
      }
      ensureCapacity(len)
      out.set(compressed.subarray(bytePos + 4, bytePos + 4 + len), outPos)
      outPos += len
      bitPos += len * 8
      continue
    }

    if (btype !== 1 && btype !== 2) {
      throw new Error(`zip: invalid deflate block type ${btype}`)
    }

    let litTable = FIXED_LIT_TABLE
    let distTable = FIXED_DIST_TABLE

    if (btype === 2) {
      const hlit = readBits(5) + 257
      const hdist = readBits(5) + 1
      const hclen = readBits(4) + 4
      const clLengths = new Uint8Array(19)
      for (let i = 0; i < hclen; i++) {
        clLengths[CL_ORDER[i]!] = readBits(3)
      }
      const clTable = buildHuffmanTable(clLengths)
      const totalCodes = hlit + hdist
      const codeLengths = new Uint8Array(totalCodes)
      let idx = 0
      while (idx < totalCodes) {
        const sym = decodeSymbol(clTable)
        if (sym < 16) {
          codeLengths[idx++] = sym
        } else if (sym === 16) {
          if (idx === 0) throw new Error('zip: invalid repeat code 16 at start')
          const prev = codeLengths[idx - 1] ?? 0
          const repeat = readBits(2) + 3
          for (let r = 0; r < repeat && idx < totalCodes; r++) {
            codeLengths[idx++] = prev
          }
        } else if (sym === 17) {
          const repeat = readBits(3) + 3
          idx += repeat
        } else if (sym === 18) {
          const repeat = readBits(7) + 11
          idx += repeat
        } else {
          throw new Error(`zip: invalid code length symbol ${sym}`)
        }
      }
      litTable = buildHuffmanTable(codeLengths.subarray(0, hlit))
      distTable = buildHuffmanTable(codeLengths.subarray(hlit, totalCodes))
    }

    while (true) {
      const sym = decodeSymbol(litTable)
      if (sym < 256) {
        ensureCapacity(1)
        out[outPos++] = sym
      } else if (sym === 256) {
        break
      } else {
        const lenIdx = sym - 257
        const baseLen = LENGTH_BASE[lenIdx]
        if (baseLen === undefined) {
          throw new Error(`zip: invalid length symbol ${sym}`)
        }
        const length = baseLen + readBits(LENGTH_EXTRA[lenIdx] ?? 0)
        const distSym = decodeSymbol(distTable)
        const baseDist = DIST_BASE[distSym]
        if (baseDist === undefined) {
          throw new Error(`zip: invalid distance symbol ${distSym}`)
        }
        const distance = baseDist + readBits(DIST_EXTRA[distSym] ?? 0)
        if (distance > outPos) {
          throw new Error('zip: distance backreference before output start')
        }
        ensureCapacity(length)
        for (let i = 0; i < length; i++) {
          out[outPos] = out[outPos - distance]!
          outPos++
        }
      }
    }
  }

  return out.subarray(0, outPos)
}

function u16(view: DataView, offset: number): number {
  return view.getUint16(offset, true)
}

function u32(view: DataView, offset: number): number {
  return view.getUint32(offset, true)
}

function findEocdOffset(buffer: Uint8Array): number {
  if (buffer.length < 22) {
    throw new Error('zip: buffer too small')
  }
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

export interface ReadZipEntriesOptions {
  maxEntryBytes?: number
  maxTotalBytes?: number
  maxEntries?: number
  /** 可选条目名过滤，仅解压命中的文件以节省内存 */
  filter?: (entryName: string) => boolean
}

/**
 * 读取 ZIP 条目（支持 store 与 deflate，内置条目数量与总体积保护）。
 */
export function readZipEntries(
  buffer: Uint8Array,
  options?: ReadZipEntriesOptions
): Map<string, Uint8Array> {
  const maxEntryBytes = options?.maxEntryBytes ?? DEFAULT_ZIP_MAX_ENTRY_BYTES
  const maxTotalBytes = options?.maxTotalBytes ?? DEFAULT_ZIP_MAX_TOTAL_BYTES
  const maxEntries = options?.maxEntries ?? DEFAULT_ZIP_MAX_ENTRIES

  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength)
  const eocd = findEocdOffset(buffer)
  const count = u16(view, eocd + 10)
  if (count > maxEntries) {
    throw new Error(`zip: entry count ${count} exceeds limit (${maxEntries})`)
  }
  let cursor = u32(view, eocd + 16)
  const entries = new Map<string, Uint8Array>()
  let totalUnpacked = 0

  for (let i = 0; i < count; i += 1) {
    if (cursor + 46 > buffer.length || u32(view, cursor) !== SIG_CEN) {
      throw new Error('zip: invalid central directory')
    }
    const flags = u16(view, cursor + 8)
    const method = u16(view, cursor + 10)
    const compressedSize = u32(view, cursor + 20)
    const uncompressedSize = u32(view, cursor + 24)
    const nameLen = u16(view, cursor + 28)
    const extraLen = u16(view, cursor + 30)
    const commentLen = u16(view, cursor + 32)
    const localOffset = u32(view, cursor + 42)
    const nameBytes = buffer.subarray(cursor + 46, cursor + 46 + nameLen)
    const name = decodeName(nameBytes, Boolean(flags & 0x800))
    cursor += 46 + nameLen + extraLen + commentLen

    if (name.endsWith('/')) continue
    if (options?.filter && !options.filter(name)) continue

    if (uncompressedSize > maxEntryBytes && uncompressedSize !== 0xffffffff) {
      throw new Error(`zip: entry ${name} exceeds maxEntryBytes (${maxEntryBytes})`)
    }

    if (localOffset + 30 > buffer.length) {
      throw new Error(`zip: invalid local header offset for ${name}`)
    }
    const localNameLen = u16(view, localOffset + 26)
    const localExtraLen = u16(view, localOffset + 28)
    const dataStart = localOffset + 30 + localNameLen + localExtraLen
    const compressed = buffer.subarray(dataStart, dataStart + compressedSize)

    let data: Uint8Array
    if (method === METHOD_STORE) {
      if (compressed.length > maxEntryBytes) {
        throw new Error(`zip: stored entry ${name} exceeds limit`)
      }
      data = compressed
    } else if (method === METHOD_DEFLATE) {
      const remainingBudget = Math.min(maxEntryBytes, maxTotalBytes - totalUnpacked)
      if (remainingBudget <= 0) {
        throw new Error(`zip: total unpacked size exceeds limit (${maxTotalBytes})`)
      }
      data = inflateRaw(compressed, remainingBudget)
    } else {
      throw new Error(`zip: unsupported compression ${method} for ${name}`)
    }

    totalUnpacked += data.length
    if (totalUnpacked > maxTotalBytes) {
      throw new Error(`zip: total unpacked size exceeds limit (${maxTotalBytes})`)
    }
    entries.set(name, data)
  }
  return entries
}

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff
  for (let i = 0; i < data.length; i += 1) {
    crc ^= data[i] ?? 0
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

/** 仅写入 store 条目，供测试构造 ZIP / EPUB / OOXML。 */
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
