/** 可选：缓存最近一次 simple 按页文本，供 OCR 合并缺失页时复用（同进程内） */
const cache = new Map<string, { texts: string[]; at: number }>()
const MAX = 8

export function rememberSimplePageTexts(absolutePath: string, texts: string[]): void {
  cache.set(absolutePath, { texts: [...texts], at: Date.now() })
  if (cache.size > MAX) {
    const oldest = [...cache.entries()].sort((a, b) => a[1].at - b[1].at)[0]
    if (oldest) cache.delete(oldest[0])
  }
}

export function getRegisteredSimplePageTexts(absolutePath: string): string[] | null {
  return cache.get(absolutePath)?.texts ?? null
}
