/** 将 message part 的 data 收窄为对象（排除纯字符串） */
export function partDataAsRecord(
  data: Record<string, unknown> | string | undefined
): Record<string, unknown> | undefined {
  return typeof data === 'object' && data !== null ? data : undefined
}
