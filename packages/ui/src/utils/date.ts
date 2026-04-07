/**
 * 生成系统统一的日期选择器年份范围
 * 从 2000 年开始，到当前日历年的未来 +30 年。
 *
 * @param reverse 是否为了体验将年份倒序输出（新的一年在上）
 * @returns number[] 年份数组
 */
export function getPickerYearRange(reverse: boolean = false): number[] {
  const currentPhysicalYear = new Date().getFullYear();
  const startYear = 2000;
  const endYear = currentPhysicalYear + 30;
  const length = endYear - startYear + 1;
  const years = Array.from({ length }, (_, i) => startYear + i);
  return reverse ? years.reverse() : years;
}
