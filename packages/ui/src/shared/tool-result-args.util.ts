import { resolveMcpToolLookupName } from '@baishou/shared'
import type { ToolInvocationLike } from './tool-result.types'

const SUBTITLE_MAX_CHARS = 56

export function readRawInvocationToolName(invocation: ToolInvocationLike): string | undefined {
  const raw = invocation.toolName || (invocation as { name?: string }).name
  if (typeof raw !== 'string' || !raw.trim()) return undefined
  return raw.trim()
}

export function readInvocationToolName(invocation: ToolInvocationLike): string | undefined {
  const raw = readRawInvocationToolName(invocation)
  if (!raw) return undefined
  return resolveMcpToolLookupName(raw).lookupName
}

export function readArgsRecord(args: unknown): Record<string, unknown> | null {
  if (args == null) return null
  if (typeof args === 'string') {
    const trimmed = args.trim()
    if (!trimmed) return null
    try {
      const parsed = JSON.parse(trimmed) as unknown
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null
    } catch {
      return null
    }
  }
  if (typeof args === 'object' && !Array.isArray(args)) {
    return args as Record<string, unknown>
  }
  return null
}

export function readArgString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed || undefined
}

export function fileNameFromPath(value: string): string {
  const normalized = value.replace(/\\/g, '/').replace(/\/+$/, '')
  const parts = normalized.split('/').filter(Boolean)
  return parts[parts.length - 1] || value
}

export function truncateSubtitle(value: string): string {
  if (value.length <= SUBTITLE_MAX_CHARS) return value
  return `${value.slice(0, SUBTITLE_MAX_CHARS - 1)}…`
}

export function formatPathishSubtitle(value: string): string {
  if (/^https?:\/\//i.test(value)) return truncateSubtitle(value)
  return truncateSubtitle(fileNameFromPath(value))
}
