/**
 * 日期工具函数
 *
 * 白守系统的日期哲学：
 *   日记以用户感知的「本地日期」归档，而非 UTC 日期。
 *   东八区用户在 2026-04-07 白天写的日记，文件名就是 2026-04-07，
 *   与他们是否跨越了 UTC 零点无关。
 *
 * 核心约定（全链路强制遵守）：
 *   - 日历日（归档日、总结区间、搜索日期标签）：formatLocalDate → YYYY-MM-DD
 *   - 具体时刻（消息时间、记忆记录时间、updated_at）：formatLocalDateTime → YYYY-MM-DD HH:mm
 *   - 仅时分秒：formatLocalTime → HH:mm:ss
 *   - Date 对象构造：使用 new Date(y, m-1, d)（本地时区构造，无 UTC 偏移）
 *   - 绝不使用 toISOString() 表达用户感知的日期/时间（协议级瞬时戳除外）
 *
 * 对标原版 Flutter：DateFormat('yyyy-MM-dd').format(date)
 */

/**
 * 将 Date 格式化为本地时区的 YYYY-MM-DD 字符串
 *
 * 等价于 Flutter 的 DateFormat('yyyy-MM-dd').format(date)
 */
/**
 * 计算周总结使用的「年内第几周」编号（与总结生成 Prompt 一致）。
 * 以当年 1 月 1 日为第 1 周起点，含首周偏移 +1。
 */
export function getSummaryWeekNumber(date: Date): number {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1)
  return Math.ceil((date.getTime() - firstDayOfYear.getTime()) / (7 * 24 * 60 * 60 * 1000) + 1)
}

export function formatLocalDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function coerceToLocalDate(value: Date | number): Date | undefined {
  const ms = value instanceof Date ? value.getTime() : (timestampToMillis(value) ?? value)
  if (!Number.isFinite(ms) || ms < Date.UTC(2000, 0, 1)) return undefined
  const d = new Date(ms)
  return Number.isNaN(d.getTime()) ? undefined : d
}

/** 时刻戳 → 本地日历日 YYYY-MM-DD（搜索标签、分组键、导出标题等） */
export function formatLocalDateFromInstant(
  value: Date | number | undefined | null
): string | undefined {
  if (value == null) return undefined
  const d = coerceToLocalDate(value instanceof Date ? value : (value as number))
  return d ? formatLocalDate(d) : undefined
}

/** 时刻戳 → 本地 YYYY-MM-DD HH:mm（与 formatMessageTimestamp 同语义，名称更直观） */
export function formatLocalDateTime(
  value: Date | number | undefined | null
): string | undefined {
  return formatMessageTimestamp(value)
}

/** 时刻戳 → 本地 HH:mm:ss */
export function formatLocalTime(value: Date | number | undefined | null): string | undefined {
  if (value == null) return undefined
  const d = coerceToLocalDate(value instanceof Date ? value : (value as number))
  if (!d) return undefined
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  const ss = String(d.getSeconds()).padStart(2, '0')
  return `${hh}:${mm}:${ss}`
}

/**
 * 将 YYYY-MM-DD 字符串解析为本地时区的 Date 对象（午夜 00:00:00 本地时间）
 *
 * ⚠️ 禁止使用 new Date('YYYY-MM-DD')，该写法会被 JS 引擎视作 UTC 零点，
 *    在东八区等非 UTC 时区会产生日期偏移一天的 Bug。
 */
export function parseDateStr(dateStr: string): Date {
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!match) {
    throw new RangeError(`[date.utils] 无效的日期字符串: "${dateStr}"，期望格式 YYYY-MM-DD`)
  }
  return new Date(parseInt(match[1]!, 10), parseInt(match[2]!, 10) - 1, parseInt(match[3]!, 10))
}

/**
 * 安全版本的 parseDateStr，解析失败时返回 fallback（默认 today）
 *
 * 适合处理来自 URL 参数、IPC 传输等不可信来源的日期字符串。
 */
export function safeParseDate(str: string | undefined | null, fallback?: Date): Date {
  if (!str) return fallback ?? new Date()
  try {
    return parseDateStr(str)
  } catch {
    return fallback ?? new Date()
  }
}

/**
 * 判断两个 Date 是否是同一个本地日期（忽略时分秒）
 *
 * 对标原版 Flutter 的 DateUtils.isSameDay(a, b)
 */
export function isSameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

/**
 * 将数据库中的 Unix 时间戳统一为毫秒。
 * memory_embeddings.source_created_at 规范为「秒」，历史数据可能误写入「毫秒」。
 */
export function timestampToMillis(ts: number | undefined | null): number | undefined {
  if (ts == null || !Number.isFinite(ts) || ts <= 0) return undefined
  return ts < 1_000_000_000_000 ? ts * 1000 : ts
}

/** 写入 DB 前统一为 Unix 秒 */
export function normalizeUnixToSeconds(ts: number): number {
  if (!Number.isFinite(ts) || ts <= 0) return Math.floor(Date.now() / 1000)
  return ts >= 1_000_000_000_000 ? Math.floor(ts / 1000) : Math.floor(ts)
}

/** 日记日历日期（本地零点）→ source_created_at 秒 */
export function diaryDateToSourceCreatedSeconds(date: Date): number {
  const localMidnight = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  return normalizeUnixToSeconds(localMidnight.getTime())
}

/** RAG 记忆列表：日记仅显示月/日，其它来源显示月/日 + 时分 */
export function formatRagEntryTimestamp(ms: number, sourceType?: string): string {
  const d = new Date(timestampToMillis(ms) ?? ms)
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  if (sourceType === 'diary') {
    return `${month}/${day}`
  }
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${month}/${day} ${hh}:${mm}`
}

/** 格式化为本地 YYYY-MM-DD HH:mm；无效时间戳返回 undefined */
export function formatStoredTimestamp(ts: number | undefined | null): string | undefined {
  const ms = timestampToMillis(ts)
  if (ms == null || ms < Date.UTC(2000, 0, 1)) return undefined
  const t = new Date(ms)
  const y = t.getFullYear()
  const m = String(t.getMonth() + 1).padStart(2, '0')
  const d = String(t.getDate()).padStart(2, '0')
  const hh = String(t.getHours()).padStart(2, '0')
  const mm = String(t.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${d} ${hh}:${mm}`
}

/** 消息 createdAt → 本地 YYYY-MM-DD HH:mm（供模型上下文前缀） */
export function formatMessageTimestamp(
  value: Date | number | undefined | null
): string | undefined {
  if (value == null) return undefined
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return undefined
    return formatStoredTimestamp(value.getTime())
  }
  return formatStoredTimestamp(value)
}
