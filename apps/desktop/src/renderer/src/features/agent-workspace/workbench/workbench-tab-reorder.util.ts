/** 只有两个及以上标签时才挂水平拖拽；空栏或单标签时库会读到空 firstChild。 */
export function shouldEnableWorkbenchTabReorder(tabCount: number): boolean {
  return tabCount >= 2
}
