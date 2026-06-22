import type { DiaryTagColorRegistry } from '@baishou/shared'

let activeTagColorRegistry: DiaryTagColorRegistry = {}

export function setActiveDiaryTagColorRegistry(registry: DiaryTagColorRegistry): void {
  activeTagColorRegistry = { ...registry }
}

export function getActiveDiaryTagColorRegistry(): DiaryTagColorRegistry {
  return activeTagColorRegistry
}

function hashTagColorIndex(tag: string): number {
  let sum = 0
  for (let i = 0; i < tag.length; i++) sum += tag.charCodeAt(i)
  return sum % 4
}

export function resolveActiveDiaryTagColorIndex(tag: string): number {
  const stored = activeTagColorRegistry[tag]
  if (stored !== undefined && stored >= 0 && stored < 4) {
    return stored
  }
  return hashTagColorIndex(tag)
}
