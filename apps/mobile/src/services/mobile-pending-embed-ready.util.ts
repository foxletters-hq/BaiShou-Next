/**
 * 计数源（管理器、仓库）为 null 时无法清点。
 * 类型守卫只负责判空；调用方签名若只能返回 number，再自行决定降级。
 */
export function hasPendingCountSource<T>(value: T | null): value is T {
  return value !== null
}
