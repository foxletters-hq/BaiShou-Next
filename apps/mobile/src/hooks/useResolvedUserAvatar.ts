import { useEffect, useState } from 'react'
import { useBaishou } from '../providers/BaishouProvider'
import { resolveUserAvatarForMobileUi } from '../lib/user-avatar-display.util'

/** 将 settings 中的用户头像路径解析为可展示的本地 URI */
export function useResolvedUserAvatar(avatarPath?: string | null): string | null {
  const { services, dbReady, vaultRevision } = useBaishou()
  const [uri, setUri] = useState<string | null>(null)

  useEffect(() => {
    setUri(null)
    if (!avatarPath || !dbReady || !services) return

    let cancelled = false
    void resolveUserAvatarForMobileUi(
      avatarPath,
      services.attachmentManager,
      services.fileSystem
    ).then((resolved) => {
      if (!cancelled) setUri(resolved ?? null)
    })

    return () => {
      cancelled = true
    }
  }, [avatarPath, dbReady, services, vaultRevision])

  return uri
}
