import { useCallback, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { settingsPathForScope, settingsScopeFromPath } from '../settings-route.util'

export function useSettingsScopeNavigation() {
  const navigate = useNavigate()
  const location = useLocation()
  const scope = settingsScopeFromPath(location.pathname)
  const isHub = scope === 'hub'

  const go = useCallback(
    (segment: string) => {
      navigate(settingsPathForScope(scope, segment))
    },
    [navigate, scope]
  )

  return useMemo(
    () => ({
      scope,
      isHub,
      go,
      goGeneral: () => go('general'),
      goWorkspaces: () => go('workspaces'),
      goIdentityCards: () => go('identity-cards'),
      goAiServices: () => go('ai-services'),
      goAiModels: () => go('ai-models'),
      goRag: () => go('rag')
    }),
    [go, isHub, scope]
  )
}
