import { cacheDirectory, documentDirectory } from './mobile-sandbox-fs'

export function getAppDocumentDirectory(): string {
  return documentDirectory || 'file:///data/user/0/com.baishou.baishou/files/'
}

export function getAppCacheDirectory(): string {
  return cacheDirectory || `${getAppDocumentDirectory()}cache/`
}
