const SAMPLE_SIZE = 8
const LUMINANCE_LIGHT_THRESHOLD = 0.52

const luminanceCache = new Map<string, number>()
const inflightLuminanceLoads = new Map<string, Promise<number | null>>()

export function clearChatBackgroundLuminanceCache(uri?: string): void {
  if (uri) {
    luminanceCache.delete(uri)
    inflightLuminanceLoads.delete(uri)
    return
  }
  luminanceCache.clear()
  inflightLuminanceLoads.clear()
}

export function peekChatBackgroundLuminance(uri?: string | null): number | null {
  if (!uri) return null
  return luminanceCache.get(uri) ?? null
}

function decodeBase64ToBytes(base64: string): Uint8Array {
  const clean = base64.replace(/^data:image\/\w+;base64,/, '').replace(/[\r\n\s]/g, '')
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  const lookup = new Int16Array(256).fill(-1)
  for (let i = 0; i < alphabet.length; i++) {
    lookup[alphabet.charCodeAt(i)] = i
  }

  const pad = clean.endsWith('==') ? 2 : clean.endsWith('=') ? 1 : 0
  const byteLength = Math.max(0, Math.floor((clean.length * 3) / 4) - pad)
  const out = new Uint8Array(byteLength)

  let outIdx = 0
  for (let i = 0; i < clean.length; i += 4) {
    const c0 = lookup[clean.charCodeAt(i)] ?? 0
    const c1 = lookup[clean.charCodeAt(i + 1)] ?? 0
    const c2 = i + 2 < clean.length ? Math.max(0, lookup[clean.charCodeAt(i + 2)]) : 0
    const c3 = i + 3 < clean.length ? Math.max(0, lookup[clean.charCodeAt(i + 3)]) : 0
    const triple = (c0 << 18) | (c1 << 12) | (c2 << 6) | c3
    if (outIdx < byteLength) out[outIdx++] = (triple >> 16) & 0xff
    if (outIdx < byteLength) out[outIdx++] = (triple >> 8) & 0xff
    if (outIdx < byteLength) out[outIdx++] = triple & 0xff
  }
  return out
}

const FIXED_LIT_LENGTHS = new Uint8Array(288)
FIXED_LIT_LENGTHS.fill(8, 0, 144)
FIXED_LIT_LENGTHS.fill(9, 144, 256)
FIXED_LIT_LENGTHS.fill(7, 256, 280)
FIXED_LIT_LENGTHS.fill(8, 280, 288)

const FIXED_DIST_LENGTHS = new Uint8Array(32).fill(5)

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
const CL_ORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]

interface HuffmanTable {
  counts: Uint16Array
  symbols: Uint16Array
}

function buildHuffman(lengths: Uint8Array): HuffmanTable {
  const counts = new Uint16Array(16)
  for (let i = 0; i < lengths.length; i++) {
    if (lengths[i] > 0) counts[lengths[i]]++
  }
  const offsets = new Uint16Array(16)
  let total = 0
  for (let bits = 1; bits <= 15; bits++) {
    offsets[bits] = total
    total += counts[bits]
  }
  const symbols = new Uint16Array(total)
  for (let sym = 0; sym < lengths.length; sym++) {
    const len = lengths[sym]
    if (len > 0) {
      symbols[offsets[len]++] = sym
    }
  }
  return { counts, symbols }
}

function inflateZlib(data: Uint8Array, expectedSize: number): Uint8Array {
  let pos = 2
  let bitBuf = 0
  let bitCount = 0

  const out = new Uint8Array(Math.max(expectedSize, 256))
  let outPos = 0

  const readBits = (n: number): number => {
    while (bitCount < n) {
      const b = pos < data.length ? data[pos++] : 0
      bitBuf |= b << bitCount
      bitCount += 8
    }
    const val = bitBuf & ((1 << n) - 1)
    bitBuf >>>= n
    bitCount -= n
    return val
  }

  const decodeSymbol = (table: HuffmanTable): number => {
    let code = 0
    let first = 0
    let index = 0
    for (let len = 1; len <= 15; len++) {
      code |= readBits(1)
      const count = table.counts[len]
      if (code - count < first) {
        return table.symbols[index + (code - first)]
      }
      index += count
      first += count
      first <<= 1
      code <<= 1
    }
    return 0
  }

  let bfinal = 0
  while (bfinal === 0 && pos <= data.length) {
    bfinal = readBits(1)
    const btype = readBits(2)

    if (btype === 0) {
      bitBuf = 0
      bitCount = 0
      const len = data[pos] | (data[pos + 1] << 8)
      pos += 4
      for (let i = 0; i < len && outPos < out.length && pos < data.length; i++) {
        out[outPos++] = data[pos++]
      }
    } else if (btype === 1 || btype === 2) {
      let litTable: HuffmanTable
      let distTable: HuffmanTable

      if (btype === 1) {
        litTable = buildHuffman(FIXED_LIT_LENGTHS)
        distTable = buildHuffman(FIXED_DIST_LENGTHS)
      } else {
        const hlit = readBits(5) + 257
        const hdist = readBits(5) + 1
        const hclen = readBits(4) + 4
        const clLengths = new Uint8Array(19)
        for (let i = 0; i < hclen; i++) {
          clLengths[CL_ORDER[i]] = readBits(3)
        }
        const clTable = buildHuffman(clLengths)
        const allLengths = new Uint8Array(hlit + hdist)
        let idx = 0
        while (idx < hlit + hdist) {
          const sym = decodeSymbol(clTable)
          if (sym < 16) {
            allLengths[idx++] = sym
          } else if (sym === 16) {
            const prev = idx > 0 ? allLengths[idx - 1] : 0
            const repeat = readBits(2) + 3
            for (let r = 0; r < repeat && idx < allLengths.length; r++) allLengths[idx++] = prev
          } else if (sym === 17) {
            const repeat = readBits(3) + 3
            idx += repeat
          } else if (sym === 18) {
            const repeat = readBits(7) + 11
            idx += repeat
          } else {
            break
          }
        }
        litTable = buildHuffman(allLengths.subarray(0, hlit))
        distTable = buildHuffman(allLengths.subarray(hlit))
      }

      while (true) {
        const sym = decodeSymbol(litTable)
        if (sym === 256) break
        if (sym < 256) {
          if (outPos < out.length) out[outPos++] = sym
        } else {
          const lenIdx = sym - 257
          if (lenIdx < 0 || lenIdx >= LENGTH_BASE.length) break
          const length = LENGTH_BASE[lenIdx] + readBits(LENGTH_EXTRA[lenIdx])
          const distSym = decodeSymbol(distTable)
          if (distSym < 0 || distSym >= DIST_BASE.length) break
          const dist = DIST_BASE[distSym] + readBits(DIST_EXTRA[distSym])
          for (let i = 0; i < length; i++) {
            const srcPos = outPos - dist
            if (outPos < out.length) {
              out[outPos++] = srcPos >= 0 ? out[srcPos] : 0
            }
          }
        }
      }
    } else {
      break
    }
  }

  return out.subarray(0, outPos)
}

function paethPredictor(a: number, b: number, c: number): number {
  const p = a + b - c
  const pa = Math.abs(p - a)
  const pb = Math.abs(p - b)
  const pc = Math.abs(p - c)
  if (pa <= pb && pa <= pc) return a
  if (pb <= pc) return b
  return c
}

/**
 * 从缩略 PNG base64 中一次性计算整张背景图的平均相对亮度（0~1）
 */
export function decodePngBase64ToLuminance(base64: string): number | null {
  try {
    const bytes = decodeBase64ToBytes(base64)
    if (bytes.length < 33) return null
    if (bytes[0] !== 0x89 || bytes[1] !== 0x50 || bytes[2] !== 0x4e || bytes[3] !== 0x47) {
      return null
    }

    let width = 0
    let height = 0
    let bitDepth = 8
    let colorType = 6
    const idatParts: Uint8Array[] = []

    let offset = 8
    while (offset + 8 <= bytes.length) {
      const len =
        ((bytes[offset] << 24) |
          (bytes[offset + 1] << 16) |
          (bytes[offset + 2] << 8) |
          bytes[offset + 3]) >>>
        0
      const type = String.fromCharCode(
        bytes[offset + 4],
        bytes[offset + 5],
        bytes[offset + 6],
        bytes[offset + 7]
      )
      const dataStart = offset + 8
      const dataEnd = dataStart + len
      if (dataEnd > bytes.length) break

      if (type === 'IHDR' && len >= 13) {
        width =
          ((bytes[dataStart] << 24) |
            (bytes[dataStart + 1] << 16) |
            (bytes[dataStart + 2] << 8) |
            bytes[dataStart + 3]) >>>
          0
        height =
          ((bytes[dataStart + 4] << 24) |
            (bytes[dataStart + 5] << 16) |
            (bytes[dataStart + 6] << 8) |
            bytes[dataStart + 7]) >>>
          0
        bitDepth = bytes[dataStart + 8]
        colorType = bytes[dataStart + 9]
      } else if (type === 'IDAT') {
        idatParts.push(bytes.subarray(dataStart, dataEnd))
      } else if (type === 'IEND') {
        break
      }

      offset = dataEnd + 4
    }

    if (width <= 0 || height <= 0 || bitDepth !== 8 || idatParts.length === 0) return null

    const channels =
      colorType === 6 ? 4 : colorType === 2 ? 3 : colorType === 4 ? 2 : colorType === 0 ? 1 : 0
    if (channels === 0) return null

    const totalIdatLen = idatParts.reduce((acc, part) => acc + part.length, 0)
    const idatCombined = new Uint8Array(totalIdatLen)
    let writeOffset = 0
    for (const part of idatParts) {
      idatCombined.set(part, writeOffset)
      writeOffset += part.length
    }

    const stride = width * channels
    const expectedRawBytes = height * (1 + stride)
    const raw = inflateZlib(idatCombined, expectedRawBytes)
    if (raw.length < expectedRawBytes) return null

    const prevRow = new Uint8Array(stride)
    const currRow = new Uint8Array(stride)
    let totalLum = 0

    for (let y = 0; y < height; y++) {
      const rowStart = y * (1 + stride)
      const filterType = raw[rowStart]

      for (let i = 0; i < stride; i++) {
        const x = raw[rowStart + 1 + i]
        const a = i >= channels ? currRow[i - channels] : 0
        const b = prevRow[i]
        const c = i >= channels ? prevRow[i - channels] : 0

        let recon = x
        if (filterType === 1) recon = (x + a) & 0xff
        else if (filterType === 2) recon = (x + b) & 0xff
        else if (filterType === 3) recon = (x + ((a + b) >> 1)) & 0xff
        else if (filterType === 4) recon = (x + paethPredictor(a, b, c)) & 0xff

        currRow[i] = recon
      }

      for (let x = 0; x < width; x++) {
        const pxOffset = x * channels
        if (channels >= 3) {
          const r = currRow[pxOffset] / 255
          const g = currRow[pxOffset + 1] / 255
          const b = currRow[pxOffset + 2] / 255
          totalLum += 0.2126 * r + 0.7152 * g + 0.0722 * b
        } else {
          totalLum += currRow[pxOffset] / 255
        }
      }
      prevRow.set(currRow)
    }

    return totalLum / (width * height)
  } catch {
    return null
  }
}

/**
 * 一次性计算整张背景图（叠加遮罩后）的明暗属性：
 * - 返回 'light'：背景整体偏亮，名称与按钮统一显示纯黑（#000000）
 * - 返回 'dark'：背景整体偏暗，名称与按钮统一显示纯白（#FFFFFF）
 */
export function resolveChatBackgroundMetaTone(params: {
  luminance?: number | null
  overlayOpacity?: number
  isDarkTheme?: boolean
}): 'light' | 'dark' {
  const { luminance, overlayOpacity = 0, isDarkTheme = false } = params
  const clampedOverlay = Math.min(100, Math.max(0, overlayOpacity))
  const overlayFactor = 1 - clampedOverlay / 100
  const baseLuminance =
    typeof luminance === 'number' && Number.isFinite(luminance)
      ? luminance
      : isDarkTheme
        ? 0.15
        : 0.85

  const effectiveLuminance = baseLuminance * overlayFactor
  return effectiveLuminance > LUMINANCE_LIGHT_THRESHOLD ? 'light' : 'dark'
}

/**
 * 异步采样移动端聊天背景图片的整体平均亮度并缓存（每张背景图只算一次）
 */
export async function loadChatBackgroundLuminance(uri: string): Promise<number | null> {
  if (!uri) return null
  const cached = luminanceCache.get(uri)
  if (cached !== undefined) return cached

  const inflight = inflightLuminanceLoads.get(uri)
  if (inflight) return inflight

  const task = (async (): Promise<number | null> => {
    try {
      const manipulator = await import('expo-image-manipulator')
      const result = await manipulator.manipulateAsync(
        uri,
        [{ resize: { width: SAMPLE_SIZE, height: SAMPLE_SIZE } }],
        { format: manipulator.SaveFormat.PNG, base64: true }
      )
      if (!result.base64) return null
      const lum = decodePngBase64ToLuminance(result.base64)
      if (lum !== null) {
        luminanceCache.set(uri, lum)
        return lum
      }
      return null
    } catch {
      return null
    } finally {
      inflightLuminanceLoads.delete(uri)
    }
  })()

  inflightLuminanceLoads.set(uri, task)
  return task
}
