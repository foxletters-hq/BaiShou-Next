/**
 * 日期工具函数
 *
 * 白守系统的日期哲学：
 *   日记以用户感知的「本地日期」归档，而非 UTC 日期。
 *   东八区用户在 2026-04-07 白天写的日记，文件名就是 2026-04-07，
 *   与他们是否跨越了 UTC 零点无关。
 *
 * 核心约定（全链路强制遵守）：
 *   - 系统内流转的日期唯一字符串格式：YYYY-MM-DD（本地时区，无时区标识）
 *   - Date 对象构造：使用 new Date(y, m-1, d)（本地时区构造，无 UTC 偏移）
 *   - 绝不使用 toISOString() 表达"日记日期"（仅 updatedAt/createdAt 时间戳可用）
 *
 * 对标原版 Flutter：DateFormat('yyyy-MM-dd').format(date)
 */

/**
 * 将 Date 格式化为本地时区的 YYYY-MM-DD 字符串
 *
 * 等价于 Flutter 的 DateFormat('yyyy-MM-dd').format(date)
 */
export function formatLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * 将 YYYY-MM-DD 字符串解析为本地时区的 Date 对象（午夜 00:00:00 本地时间）
 *
 * ⚠️ 禁止使用 new Date('YYYY-MM-DD')，该写法会被 JS 引擎视作 UTC 零点，
 *    在东八区等非 UTC 时区会产生日期偏移一天的 Bug。
 */
export function parseDateStr(dateStr: string): Date {
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) {
    throw new RangeError(`[date.utils] 无效的日期字符串: "${dateStr}"，期望格式 YYYY-MM-DD`);
  }
  return new Date(
    parseInt(match[1]!, 10),
    parseInt(match[2]!, 10) - 1,
    parseInt(match[3]!, 10),
  );
}

/**
 * 安全版本的 parseDateStr，解析失败时返回 fallback（默认 today）
 *
 * 适合处理来自 URL 参数、IPC 传输等不可信来源的日期字符串。
 */
export function safeParseDate(str: string | undefined | null, fallback?: Date): Date {
  if (!str) return fallback ?? new Date();
  try {
    return parseDateStr(str);
  } catch {
    return fallback ?? new Date();
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
  );
}
