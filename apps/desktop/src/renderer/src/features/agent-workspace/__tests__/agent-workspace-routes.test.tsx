import { describe, expect, it } from 'vitest'
import { matchRoutes } from 'react-router-dom'

const workspaceInnerRoutes = [
  {
    path: '/agent-workspace',
    children: [
      { index: true },
      { path: 'knowledge' },
      { path: 'skills' },
      { path: 'projects' },
      { path: 'open/:workspaceId' },
      { path: ':sessionId' }
    ]
  }
]

const appMainRoutes = [
  { path: '/agent-workspace/knowledge/:notebookId' },
  { path: '/agent-workspace/*' }
]

describe('agent-workspace knowledge routes', () => {
  it('keeps the notebook list on the static knowledge route', () => {
    const list = matchRoutes(workspaceInnerRoutes, '/agent-workspace/knowledge')
    const session = matchRoutes(workspaceInnerRoutes, '/agent-workspace/sess-1')
    expect(list?.at(-1)?.route.path).toBe('knowledge')
    expect(session?.at(-1)?.route.path).toBe(':sessionId')
  })

  it('opens notebook detail on the app outlet route, not the workbench splat', () => {
    const detail = matchRoutes(appMainRoutes, '/agent-workspace/knowledge/nb-1')
    const list = matchRoutes(appMainRoutes, '/agent-workspace/knowledge')
    expect(detail?.at(-1)?.route.path).toBe('/agent-workspace/knowledge/:notebookId')
    expect(list?.at(-1)?.route.path).toBe('/agent-workspace/*')
  })
})
