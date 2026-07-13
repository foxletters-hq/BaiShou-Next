function toMillis(value: string | Date | null | undefined): number {
  if (value == null || value === '') return 0
  if (value instanceof Date) {
    const ms = value.getTime()
    return Number.isFinite(ms) ? ms : 0
  }
  const ms = Date.parse(String(value))
  return Number.isFinite(ms) ? ms : 0
}

function toIsoString(value: string | Date): string {
  if (value instanceof Date) return value.toISOString()
  return String(value)
}

export type SummaryTimeKind = 'generated' | 'saved'

export type SummaryTimeDisplay = {
  kind: SummaryTimeKind
  /** i18n key：summary.generated_at / summary.saved_at */
  labelKey: 'summary.generated_at' | 'summary.saved_at'
  at: string
}

/**
 * 未二次修改 → 生成于；手动保存过（updatedAt 晚于 generatedAt）→ 保存于。
 */
export function resolveSummaryTimeDisplay(input: {
  generatedAt?: string | Date | null
  updatedAt?: string | Date | null
}): SummaryTimeDisplay | null {
  const generatedMs = toMillis(input.generatedAt)
  const updatedMs = toMillis(input.updatedAt)

  if (updatedMs > 0 && (generatedMs === 0 || updatedMs > generatedMs + 1000)) {
    return {
      kind: 'saved',
      labelKey: 'summary.saved_at',
      at: toIsoString(input.updatedAt as string | Date)
    }
  }
  if (generatedMs > 0 && input.generatedAt != null) {
    return {
      kind: 'generated',
      labelKey: 'summary.generated_at',
      at: toIsoString(input.generatedAt)
    }
  }
  return null
}
