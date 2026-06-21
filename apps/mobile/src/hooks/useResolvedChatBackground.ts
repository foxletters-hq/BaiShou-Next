import { useEffect, useRef, useState } from 'react'
import { useBaishou } from '../providers/BaishouProvider'

/**
 * 将 settings 中的 chatBackgroundPath 解析为移动端 Image 可展示的 URI。
 * 如果路径为空则返回 null（使用默认背景）。
 */
export function useResolvedChatBackground(backgroundPath?: string | null): string | null {
  const { services, dbReady, vaultRevision } = useBaishou()
  const [uri, setUri] = useState<string | null>(null)
  const prevPathRef = useRef(backgroundPath)

  useEffect(() => {
    const pathChanged = prevPathRef.current !== backgroundPath
    prevPathRef.current = backgroundPath

    if (!backgroundPath || !dbReady || !services) {
      if (!backgroundPath) setUri(null)
      return
    }

    if (pathChanged) {
      setUri(null)
    }

    let cancelled = false
    void services.attachmentManager
      .resolveBackgroundPath(backgroundPath)
      .then((resolved) => {
        if (!cancelled) setUri(resolved ?? null)
      })
      .catch(() => {
        if (!cancelled) setUri(null)
      })

    return () => {
      cancelled = true
    }
  }, [backgroundPath, dbReady, services, vaultRevision])

  return uri
}