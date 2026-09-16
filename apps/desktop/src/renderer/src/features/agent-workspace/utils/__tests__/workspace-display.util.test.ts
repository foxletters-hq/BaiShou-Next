import { describe, expect, it } from 'vitest'
import type { AgentWorkspaceEntry } from '@baishou/shared'
import { formatCompactRelativeTime, sortAgentWorkspaces } from '../workspace-display.util'

function workspace(
  id: string,
  updatedAt: string,
  pinnedAt?: string | null
): AgentWorkspaceEntry {
  return {
    id,
    folderRoot: `D:/${id}`,
    displayName: id,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt,
    pinnedAt
  }
}

function translateFallback(
  _key: string,
  fallback: string,
  options?: { count?: number }
): string {
  if (options?.count == null) return fallback
  return fallback.replaceAll('{{count}}', String(options.count))
}

function translateEnglish(
  key: string,
  fallback: string,
  options?: { count?: number }
): string {
  const en: Record<string, string> = {
    'common.compact_just_now': 'now',
    'common.compact_minutes': '{{count}}m',
    'common.compact_hours': '{{count}}h',
    'common.compact_days': '{{count}}d'
  }
  return translateFallback(key, en[key] ?? fallback, options)
}

function translateJapanese(
  key: string,
  fallback: string,
  options?: { count?: number }
): string {
  const ja: Record<string, string> = {
    'common.compact_just_now': '今',
    'common.compact_minutes': '{{count}}分',
    'common.compact_hours': '{{count}}時間',
    'common.compact_days': '{{count}}日'
  }
  return translateFallback(key, ja[key] ?? fallback, options)
}

describe('formatCompactRelativeTime', () => {
  const now = Date.parse('2026-08-19T18:00:00.000Z')

  it('should use the same language for all compact units when locale is Chinese', () => {
    expect(
      formatCompactRelativeTime('2026-08-19T17:59:30.000Z', {
        t: translateFallback,
        nowMs: now
      })
    ).toBe('刚刚')
    expect(
      formatCompactRelativeTime('2026-08-19T17:17:00.000Z', {
        t: translateFallback,
        nowMs: now
      })
    ).toBe('43分钟')
    expect(
      formatCompactRelativeTime('2026-08-19T11:00:00.000Z', {
        t: translateFallback,
        nowMs: now
      })
    ).toBe('7小时')
    expect(
      formatCompactRelativeTime('2026-08-17T18:00:00.000Z', {
        t: translateFallback,
        nowMs: now
      })
    ).toBe('2天')
  })

  it('should switch compact units through i18n when locale is English', () => {
    expect(
      formatCompactRelativeTime('2026-08-19T17:59:30.000Z', {
        t: translateEnglish,
        nowMs: now
      })
    ).toBe('now')
    expect(
      formatCompactRelativeTime('2026-08-19T17:17:00.000Z', {
        t: translateEnglish,
        nowMs: now
      })
    ).toBe('43m')
    expect(
      formatCompactRelativeTime('2026-08-19T11:00:00.000Z', {
        t: translateEnglish,
        nowMs: now
      })
    ).toBe('7h')
    expect(
      formatCompactRelativeTime('2026-08-17T18:00:00.000Z', {
        t: translateEnglish,
        nowMs: now
      })
    ).toBe('2d')
  })

  it('should use 今 instead of たった今 when locale is Japanese', () => {
    expect(
      formatCompactRelativeTime('2026-08-19T17:59:30.000Z', {
        t: translateJapanese,
        nowMs: now
      })
    ).toBe('今')
    expect(
      formatCompactRelativeTime('2026-08-19T11:00:00.000Z', {
        t: translateJapanese,
        nowMs: now
      })
    ).toBe('7時間')
  })
})

describe('sortAgentWorkspaces', () => {
  it('moves pinned workspaces above last-active and more recent ones', () => {
    const sorted = sortAgentWorkspaces(
      [
        workspace('recent', '2026-08-14T00:00:00.000Z'),
        workspace('active', '2026-08-10T00:00:00.000Z'),
        workspace('pinned', '2026-01-01T00:00:00.000Z', '2026-08-15T00:00:00.000Z')
      ],
      'active'
    )
    expect(sorted.map((item) => item.id)).toEqual(['pinned', 'active', 'recent'])
  })
})
