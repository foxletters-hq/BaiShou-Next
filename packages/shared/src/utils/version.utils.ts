/** 白守 Next 产品线固定前缀（营销展示用，不写入 version.json） */
export const NEXT_PRODUCT_LINE = 'Next'

const SEMVER_CORE_RE = /(\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?)/

/**
 * 从任意版本串提取 semver 数字段（供 electron-updater / package.json 使用）。
 * 兼容旧格式 `Next-1.0.0` 与新版仅数字 `1.0.0`。
 */
export function toElectronSemver(raw: string | undefined | null): string {
  const cleaned = (raw ?? '').trim().replace(/^v+/i, '')
  if (!cleaned) return '0.0.0'

  const withoutLinePrefix = cleaned.replace(/^next[-.\s]*/i, '').trim()
  const candidate = withoutLinePrefix || cleaned
  const match = candidate.match(SEMVER_CORE_RE)
  return match?.[1] ?? '0.0.0'
}

/** 规范化应用版本号（仅 semver 数字段） */
export function normalizeAppVersionNumber(raw: string | undefined | null): string {
  return toElectronSemver(raw)
}

/** 组装营销版本：`Next-1.0.0` */
export function buildNextMarketingVersion(versionNumber: string): string {
  const num = normalizeAppVersionNumber(versionNumber)
  if (!num || num === '0.0.0') return NEXT_PRODUCT_LINE
  return `${NEXT_PRODUCT_LINE}-${num}`
}

/** About / 设置页展示：`Next 1.0.0` */
export function formatAppVersion(raw: string | undefined | null): string {
  const cleaned = (raw ?? '').trim().replace(/^v+/i, '')
  if (!cleaned) return ''

  if (/^next/i.test(cleaned)) {
    const suffix = cleaned.replace(/^next[-.\s]*/i, '').trim()
    return suffix ? `${NEXT_PRODUCT_LINE} ${suffix}` : NEXT_PRODUCT_LINE
  }

  const semver = toElectronSemver(cleaned)
  if (semver !== '0.0.0') {
    return `${NEXT_PRODUCT_LINE} ${semver}`
  }

  return `v${cleaned}`
}
