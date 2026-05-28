const SEP = '/'

function normalizeSeparators(p: string): string {
  return p.replace(/\\/g, SEP)
}

function isAbsolute(p: string): boolean {
  return p.startsWith(SEP) || /^[A-Za-z]:/.test(p)
}

function splitSegments(p: string): string[] {
  return normalizeSeparators(p)
    .split(SEP)
    .filter((s) => s.length > 0)
}

function resolveSegments(segments: string[], absolutePrefix?: string): string {
  const out: string[] = []
  for (const seg of segments) {
    if (seg === '.') continue
    if (seg === '..') {
      if (out.length > 0) out.pop()
      continue
    }
    out.push(seg)
  }

  if (absolutePrefix) {
    return absolutePrefix + out.join(SEP)
  }
  if (out.length === 0) return '.'
  return out.join(SEP)
}

export function join(...parts: string[]): string {
  if (parts.length === 0) return '.'

  const hasFileUri = parts.some((p) => p.startsWith('file://'))
  if (hasFileUri) {
    let result = ''
    for (const part of parts) {
      if (!part) continue
      if (part.startsWith('file://')) {
        result = part
        continue
      }
      const seg = part.replace(/\\/g, '/').replace(/^\/+/, '')
      if (!seg) continue
      result = result.endsWith('/') ? result + seg : result + '/' + seg
    }
    return result.replace(/([^:]\/)\/+/g, '$1')
  }

  let result = ''
  for (const part of parts) {
    if (!part) continue
    const p = normalizeSeparators(part)
    if (isAbsolute(p)) {
      result = p
      continue
    }
    if (!result || result.endsWith(SEP)) {
      result += p
    } else {
      result += SEP + p
    }
  }

  return result || '.'
}

export function dirname(p: string): string {
  if (p.startsWith('file://')) {
    const idx = p.lastIndexOf('/')
    if (idx <= 'file://'.length) return p
    return p.slice(0, idx)
  }
  const normalized = normalizeSeparators(p)
  const idx = normalized.lastIndexOf(SEP)
  if (idx === -1) return '.'
  if (idx === 0) return SEP
  const dir = normalized.slice(0, idx)
  return dir || (isAbsolute(normalized) ? SEP : '.')
}

export function basename(p: string, ext?: string): string {
  const normalized = normalizeSeparators(p)
  let base = normalized.slice(normalized.lastIndexOf(SEP) + 1)
  if (ext && base.endsWith(ext)) {
    base = base.slice(0, -ext.length)
  }
  return base
}

export function extname(p: string): string {
  const base = basename(p)
  const dot = base.lastIndexOf('.')
  if (dot <= 0) return ''
  return base.slice(dot)
}

export function resolve(...parts: string[]): string {
  let resolved = ''
  for (const part of parts) {
    if (!part) continue
    const p = normalizeSeparators(part)
    if (isAbsolute(p)) {
      resolved = p
    } else {
      resolved = resolved ? join(resolved, p) : p
    }
  }

  if (!resolved) return '.'

  const driveMatch = /^([A-Za-z]:)/.exec(resolved)
  const drive = driveMatch?.[1]
  let body = drive ? resolved.slice(drive.length) : resolved
  if (body.startsWith(SEP)) body = body.slice(1)

  const absolutePrefix = drive ? drive + SEP : resolved.startsWith(SEP) ? SEP : undefined
  return resolveSegments(splitSegments(body), absolutePrefix)
}

/** Path of `to` relative to `from` (both normalized with `/`). */
export function relative(from: string, to: string): string {
  const fromParts = splitSegments(resolve(from))
  const toParts = splitSegments(resolve(to))

  let i = 0
  while (i < fromParts.length && i < toParts.length && fromParts[i] === toParts[i]) {
    i++
  }

  const up = fromParts.length - i
  const rest = toParts.slice(i)
  const segments = [...Array(up).fill('..'), ...rest]
  return segments.length === 0 ? '' : segments.join(SEP)
}
