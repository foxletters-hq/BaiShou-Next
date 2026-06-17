import { normalizeStoragePath } from './android-external-fs'

/** 拼接磁盘绝对路径（不含 file://），避免 `file:///…` 与中文文件名混拼导致 stat 失败 */
export function joinStoragePath(base: string, ...segments: string[]): string {
  const basePath = normalizeStoragePath(base).replace(/\/+$/, '')
  const tail = segments
    .filter((segment) => segment != null && segment !== '')
    .map((segment) => normalizeStoragePath(segment).replace(/^\/+/, '').replace(/\/+$/, ''))
    .filter(Boolean)
    .join('/')
  return tail ? `${basePath}/${tail}` : basePath
}
