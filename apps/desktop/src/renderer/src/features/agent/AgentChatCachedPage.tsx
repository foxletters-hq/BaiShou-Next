import React, { useContext, useMemo, useRef } from 'react'
import { Routes, Route, useLocation, type Location } from 'react-router-dom'
import { AgentLayout } from './AgentLayout'
import { AgentScreen } from './AgentScreen'
import { MainPageCacheActiveContext } from '../../layouts/MainPageCache'
import { useDesktopSettingsOverlay } from '../../layouts/desktop-settings-overlay.context'

function parseFrozenChatLocation(pathWithSearch: string): Pick<Location, 'pathname' | 'search'> {
  const qIndex = pathWithSearch.indexOf('?')
  if (qIndex === -1) {
    return { pathname: pathWithSearch, search: '' }
  }
  return {
    pathname: pathWithSearch.slice(0, qIndex),
    search: pathWithSearch.slice(qIndex)
  }
}

/**
 * 伙伴聊天页保活壳：离开 /chat 时冻结路由位置，避免卸载 AgentLayout 及其子状态。
 * （/chat 在 MainPageCache 中与日记同为持久保活页）
 */
export const AgentChatCachedPage: React.FC = () => {
  const location = useLocation()
  const isActive = useContext(MainPageCacheActiveContext)
  const settingsOverlayOpen = useDesktopSettingsOverlay()
  const frozenPathRef = useRef('/chat')

  // 设置 overlay 打开时也冻结，避免底层 location 抖动传到嵌套 Routes
  const followLiveLocation =
    isActive && !settingsOverlayOpen && location.pathname.startsWith('/chat')

  if (followLiveLocation) {
    frozenPathRef.current = `${location.pathname}${location.search}`
  }

  const routesLocation = useMemo(() => {
    if (followLiveLocation) return location
    const frozen = parseFrozenChatLocation(frozenPathRef.current)
    return {
      ...location,
      pathname: frozen.pathname,
      search: frozen.search
    }
  }, [followLiveLocation, location])

  return (
    <Routes location={routesLocation}>
      <Route path="/chat" element={<AgentLayout />}>
        <Route index element={<AgentScreen key="__new-chat__" />} />
        <Route path=":sessionId" element={<AgentScreen />} />
      </Route>
    </Routes>
  )
}
