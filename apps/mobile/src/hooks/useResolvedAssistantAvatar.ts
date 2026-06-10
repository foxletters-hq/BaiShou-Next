import { useEffect, useState } from 'react'
import {
  isAssistantAvatarDirectUri,
  isAssistantAvatarRelativePath,
  isDefaultAssistantAvatarPath
} from '@baishou/shared'
import { useBaishou } from '../providers/BaishouProvider'

/** 将 settings 中的伙伴头像路径解析为可展示的本地 URI */
export function useResolvedAssistantAvatar(avatarPath?: string | null): string | null {
  const { services, dbReady } = useBaishou()
  const [uri, setUri] = useState<string | null>(null)

  useEffect(() => {
    if (isDefaultAssistantAvatarPath(avatarPath)) {
      setUri(null)
      return
    }
    if (avatarPath && isAssistantAvatarDirectUri(avatarPath)) {
      setUri(avatarPath)
      return
    }
    if (!avatarPath || !isAssistantAvatarRelativePath(avatarPath) || !dbReady || !services) {
      setUri(null)
      return
    }
    let cancelled = false
    services.attachmentManager
      .resolveAvatarPath(avatarPath)
      .then((resolved) => {
        if (!cancelled) setUri(resolved)
      })
      .catch(() => {
        if (!cancelled) setUri(null)
      })
    return () => {
      cancelled = true
    }
  }, [avatarPath, dbReady, services])

  return uri
}
