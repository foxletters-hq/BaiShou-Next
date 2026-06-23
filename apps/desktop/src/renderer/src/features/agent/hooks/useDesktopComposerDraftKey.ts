import { useEffect, useMemo, useState } from 'react'
import {
  getDesktopVaultScopeKey,
  subscribeDesktopVaultScope
} from '../../../cache/desktop-vault-scope'

/** 按工作区 + 会话隔离输入框草稿（桌面） */
export function useDesktopComposerDraftKey(sessionId: string | undefined) {
  const [vaultKey, setVaultKey] = useState(() => getDesktopVaultScopeKey())

  useEffect(() => subscribeDesktopVaultScope(() => setVaultKey(getDesktopVaultScopeKey())), [])

  return useMemo(
    () => `agent-composer:${vaultKey}:${sessionId ?? 'new'}`,
    [vaultKey, sessionId]
  )
}
