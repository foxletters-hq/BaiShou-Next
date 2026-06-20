import { normalizeRefAudioPath } from './ref-audio-path.util'

export interface TtsRefAudioPickResult {
  path: string
  base64: string
}

export type TtsRefAudioPickValue = string | TtsRefAudioPickResult

export function parseRefAudioPick(
  value: TtsRefAudioPickValue | null | undefined
): { path: string; base64?: string } | null {
  if (!value) return null
  if (typeof value === 'string') {
    const path = normalizeRefAudioPath(value)
    return path ? { path } : null
  }
  const path = normalizeRefAudioPath(value.path)
  const base64 = value.base64?.trim()
  if (!path || !base64) return null
  return { path, base64 }
}

export function refAudioCacheToken(path?: string, base64?: string): string {
  const trimmedBase64 = base64?.trim()
  if (trimmedBase64) {
    const pure = trimmedBase64.replace(/^data:[^;]+;base64,/, '')
    let hash = 0
    for (let i = 0; i < pure.length; i++) {
      hash = (hash * 31 + pure.charCodeAt(i)) >>> 0
    }
    return `b64:${pure.length}:${hash.toString(16)}`
  }
  return normalizeRefAudioPath(path || '')
}
