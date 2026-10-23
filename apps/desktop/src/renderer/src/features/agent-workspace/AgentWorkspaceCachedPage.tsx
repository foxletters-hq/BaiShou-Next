import React, { Suspense, lazy, useContext, useMemo, useRef } from 'react'
import { Routes, Route, Navigate, useLocation, type Location } from 'react-router-dom'
import { AgentWorkspaceLayout } from './AgentWorkspaceLayout'
import { WorkbenchHomePage } from './workbench/WorkbenchHomePage'
import { WorkbenchPlaceholderPage } from './workbench/home/WorkbenchPlaceholderPage'
import { MainPageCacheActiveContext } from '../../layouts/MainPageCache'

const AgentWorkspaceScreen = lazy(() =>
  import('./AgentWorkspaceScreen').then((m) => ({ default: m.AgentWorkspaceScreen }))
)
const KnowledgeListPage = lazy(() =>
  import('../knowledge/KnowledgeListPage').then((m) => ({ default: m.KnowledgeListPage }))
)
const WorkbenchSkillsPage = lazy(() =>
  import('./workbench/skills/WorkbenchSkillsPage').then((m) => ({ default: m.WorkbenchSkillsPage }))
)

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
 * index = 目录首页；open/:workspaceId = 工作台；:sessionId = 工作台+会话
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
        <Route index element={<WorkbenchHomePage />} />
        <Route
          path="knowledge"
          element={
            <Suspense fallback={null}>
              <KnowledgeListPage />
            </Suspense>
          }
        />
        <Route
          path="skills"
          element={
            <Suspense fallback={null}>
              <WorkbenchSkillsPage />
            </Suspense>
          }
        />
        <Route path="templates" element={<Navigate to="/agent-workspace/skills" replace />} />
        <Route path="projects" element={<WorkbenchPlaceholderPage section="projects" />} />
        <Route
          path="open/:workspaceId"
          element={
            <Suspense fallback={null}>
              <AgentWorkspaceScreen />
            </Suspense>
          }
        />
        <Route
          path=":sessionId"
          element={
            <Suspense fallback={null}>
              <AgentWorkspaceScreen />
            </Suspense>
          }
        />
      </Route>
    </Routes>
  )
}
