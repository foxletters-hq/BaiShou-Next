export const GIT_SPLIT_MIN = 0.22
export const GIT_SPLIT_MAX = 0.78
export const GIT_SPLIT_DEFAULT = 0.48
export const GIT_SPLIT_STORAGE_KEY = 'baishou:workbench-git-split'

export function clampGitSplitRatio(value: number): number {
  if (!Number.isFinite(value)) return GIT_SPLIT_DEFAULT
  return Math.min(GIT_SPLIT_MAX, Math.max(GIT_SPLIT_MIN, value))
}

export function nextGitSplitRatio(
  startRatio: number,
  containerHeight: number,
  deltaY: number
): number {
  if (containerHeight <= 0) return clampGitSplitRatio(startRatio)
  return clampGitSplitRatio(startRatio + deltaY / containerHeight)
}

export function loadGitSplitRatio(): number {
  try {
    const raw = localStorage.getItem(GIT_SPLIT_STORAGE_KEY)
    if (raw == null || raw === '') return GIT_SPLIT_DEFAULT
    return clampGitSplitRatio(Number(raw))
  } catch {
    return GIT_SPLIT_DEFAULT
  }
}

export function persistGitSplitRatio(ratio: number): void {
  localStorage.setItem(GIT_SPLIT_STORAGE_KEY, String(clampGitSplitRatio(ratio)))
}
