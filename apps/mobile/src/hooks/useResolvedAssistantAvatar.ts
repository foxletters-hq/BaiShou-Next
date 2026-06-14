import { useEffect, useState } from 'react'
import { useBaishou } from '../providers/BaishouProvider'
import { resolveAssistantAvatarForMobileUi } from '../lib/assistant-avatar-display.util'

/** 将 settings 中的伙伴头像路径解析为可展示的本地 URI */
export function useResolvedAssistantAvatar(avatarPath?: string | null): string | null {
  const { services, dbReady } = useBaishou()
  const [uri, setUri] = useState<string | null>(null)

  useEffect(() => {
    setUri(null)
    if (!avatarPath || !dbReady || !services) return

    let cancelled = false
    void resolveAssistantAvatarForMobileUi(
      avatarPath,
      services.attachmentManager,
      services.fileSystem
    ).then((resolved) => {
      if (!cancelled) setUri(resolved ?? null)
    })

    return () => {
      cancelled = true
    }
  }, [avatarPath, dbReady, services])

  return uri
}
