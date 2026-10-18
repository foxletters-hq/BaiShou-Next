export type SegmentedItemFrame = { x: number; width: number }

export function segmentedThumbRect(
  frames: ReadonlyArray<SegmentedItemFrame | undefined>,
  activeIndex: number
): { left: number; width: number } | null {
  if (activeIndex < 0 || activeIndex >= frames.length) return null
  const frame = frames[activeIndex]
  if (!frame || !(frame.width > 0)) return null
  return { left: frame.x, width: frame.width }
}

/** stretch 轨道尚未量到各段时，按等分宽度立刻给出选中块位置。 */
export function segmentedEqualThumbRect(
  trackWidth: number,
  count: number,
  activeIndex: number
): { left: number; width: number } | null {
  if (!(trackWidth > 0) || count <= 0) return null
  if (activeIndex < 0 || activeIndex >= count) return null
  const width = trackWidth / count
  return { left: width * activeIndex, width }
}

export function segmentedEqualItemFrames(
  trackWidth: number,
  count: number
): SegmentedItemFrame[] | null {
  if (!(trackWidth > 0) || count <= 0) return null
  const width = trackWidth / count
  return Array.from({ length: count }, (_, index) => ({ x: width * index, width }))
}
