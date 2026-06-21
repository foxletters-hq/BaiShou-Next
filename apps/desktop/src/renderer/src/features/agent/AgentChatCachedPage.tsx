import React, { useContext, useMemo, useRef } from 'react'
import { Routes, Route, useLocation, type Location } from 'react-router-dom'
import { AgentLayout } from './AgentLayout'
import { AgentScreen } from './AgentScreen'
import { MainPageCacheActiveContext } from '../../layouts/MainPageCache'

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
 */
export const AgentChatCachedPage: React.FC = () => {
  const location = useLocation()
  const isActive = useContext(MainPageCacheActiveContext)
  const frozenPathRef = useRef('/chat')

  if (isActive && location.pathname.startsWith('/chat')) {
    frozenPathRef.current = `${location.pathname}${location.search}`
  }

  const routesLocation = useMemo(() => {
    if (isActive) return location
    const frozen = parseFrozenChatLocation(frozenPathRef.current)
    return {
      ...location,
      pathname: frozen.pathname,
      search: frozen.search
    }
  }, [isActive, location])

  return (
    <Routes location={routesLocation}>
      <Route path="/chat" element={<AgentLayout />}>
        <Route index element={<AgentScreen />} />
        <Route path=":sessionId" element={<AgentScreen />} />
      </Route>
    </Routes>
  )
}
