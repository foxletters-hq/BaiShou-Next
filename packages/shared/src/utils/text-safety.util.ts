/**
 * 文本安全工具：处理 UTF-16 代理项（surrogate）相关问题。
 *
 * 背景：JS 字符串按 UTF-16 码元存储，一个 emoji（如 😀）由高代理 + 低代理两个码元组成。
 * 用 `slice` / `substring` 按长度截断时可能正好切在两者之间，留下一个孤立的高代理。
 * `JSON.stringify` 会把它输出为 `"\ud83d"` 这样的转义；多数宽松解析器能接受，
 * 但 DeepSeek 等服务端使用的严格 JSON 解析器（serde_json）会直接报
 * `unexpected end of hex escape` 并返回 400。
 *
 * 因此所有“按字符数截断再拼后缀”的场景都应使用 `truncateTextSafe`，
 * 而发往模型的文本应经过 `sanitizeUnpairedSurrogates` / `sanitizeSurrogatesDeep` 兜底。
 */

const REPLACEMENT_CHAR = '\uFFFD'

function isHighSurrogateCode(code: number): boolean {
  return code >= 0xd800 && code <= 0xdbff
}

function isLowSurrogateCode(code: number): boolean {
  return code >= 0xdc00 && code <= 0xdfff
}

/** 字符串中是否存在无法配对的代理项码元 */
export function hasUnpairedSurrogates(text: string): boolean {
  if (!text) return false
  const length = text.length
  for (let i = 0; i < length; i++) {
    const code = text.charCodeAt(i)
    if (!isHighSurrogateCode(code) && !isLowSurrogateCode(code)) continue

    if (isHighSurrogateCode(code) && i + 1 < length && isLowSurrogateCode(text.charCodeAt(i + 1))) {
      i += 1
      continue
    }
    return true
  }
  return false
}

/**
 * 将孤立的高/低代理项替换为 U+FFFD，保留成对的合法代理项。
 * 没有坏字符时原样返回同一个字符串引用，便于上层做引用比较。
 */
export function sanitizeUnpairedSurrogates(text: string): string {
  if (!text) return text

  let output: string | null = null
  let lastIndex = 0
  const length = text.length

  for (let i = 0; i < length; i++) {
    const code = text.charCodeAt(i)
    const high = isHighSurrogateCode(code)
    const low = isLowSurrogateCode(code)
    if (!high && !low) continue

    if (high && i + 1 < length && isLowSurrogateCode(text.charCodeAt(i + 1))) {
      i += 1
      continue
    }

    if (output === null) output = ''
    output += text.slice(lastIndex, i) + REPLACEMENT_CHAR
    lastIndex = i + 1
  }

  if (output === null) return text
  return output + text.slice(lastIndex)
}

/**
 * 按 UTF-16 长度截断，但绝不把代理对切成两半。
 * 仅在确实超出长度时追加 suffix。
 */
export function truncateTextSafe(text: string, maxLength: number, suffix = ''): string {
  if (!text) return text
  if (maxLength <= 0) return text.length > 0 ? suffix : text
  if (text.length <= maxLength) return text

  let end = Math.min(maxLength, text.length)
  if (
    end > 0 &&
    end < text.length &&
    isHighSurrogateCode(text.charCodeAt(end - 1)) &&
    isLowSurrogateCode(text.charCodeAt(end))
  ) {
    end -= 1
  }

  return `${text.slice(0, end)}${suffix}`
}

/**
 * 深度清理对象/数组中的孤立代理项，用于请求体、消息列表等任意嵌套结构。
 * 只遍历数组与普通对象（以及字符串），不会克隆 Uint8Array、Date 等特殊对象。
 */
export function sanitizeSurrogatesDeep<T>(value: T): T {
  if (typeof value === 'string') {
    return sanitizeUnpairedSurrogates(value) as unknown as T
  }

  if (Array.isArray(value)) {
    let changed = false
    const next = value.map((item) => {
      const sanitized = sanitizeSurrogatesDeep(item)
      if (sanitized !== item) changed = true
      return sanitized
    })
    return (changed ? next : value) as unknown as T
  }

  if (value !== null && typeof value === 'object') {
    const prototype = Object.getPrototypeOf(value)
    if (prototype !== Object.prototype && prototype !== null) return value

    let changed = false
    const next: Record<string, unknown> = {}
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      const sanitized = sanitizeSurrogatesDeep(item)
      if (sanitized !== item) changed = true
      next[key] = sanitized
    }
    return (changed ? next : value) as unknown as T
  }

  return value
}
