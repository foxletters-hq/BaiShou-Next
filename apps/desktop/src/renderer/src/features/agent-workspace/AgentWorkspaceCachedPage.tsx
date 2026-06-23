import React, { useContext, useMemo, useRef } from 'react'
import { Routes, Route, useLocation, type Location } from 'react-router-dom'
import { AgentWorkspaceLayout } from './AgentWorkspaceLayout'
import { AgentWorkspaceScreen } from './AgentWorkspaceScreen'
import { MainPageCacheActiveContext } from '../../layouts/MainPageCache'

function parseFrozenLocation(pathWithSearch: string): Pick<Location, 'pathname' | 'search'> {
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
 * Agent 工作区保活壳：离开 /agent-workspace 时冻结路由位置。
 */
export const AgentWorkspaceCachedPage: React.FC = () => {
  const location = useLocation()
  const isActive = useContext(MainPageCacheActiveContext)
  const frozenPathRef = useRef('/agent-workspace')

  if (isActive && location.pathname.startsWith('/agent-workspace')) {
    frozenPathRef.current = `${location.pathname}${location.search}`
  }

  const routesLocation = useMemo(() => {
    if (isActive) return location
    const frozen = parseFrozenLocation(frozenPathRef.current)
    return {
      ...location,
      pathname: frozen.pathname,
      search: frozen.search
    }
  }, [isActive, location])

  return (
    <Routes location={routesLocation}>
      <Route path="/agent-workspace" element={<AgentWorkspaceLayout />}>
        <Route index element={<AgentWorkspaceScreen />} />
        <Route path=":sessionId" element={<AgentWorkspaceScreen />} />
      </Route>
    </Routes>
  )
}
