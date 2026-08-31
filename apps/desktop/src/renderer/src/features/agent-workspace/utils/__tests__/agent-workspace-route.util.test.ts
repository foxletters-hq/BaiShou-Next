import { describe, expect, it } from 'vitest'
import { getMainPageCacheKey } from '../../../../layouts/MainPageCache'
import { isAgentWorkspaceKnowledgeDetailPath } from '../agent-workspace-route.util'

describe('isAgentWorkspaceKnowledgeDetailPath', () => {
  it('matches a notebook detail path and rejects the list and other workbench paths', () => {
    expect(isAgentWorkspaceKnowledgeDetailPath('/agent-workspace/knowledge/nb-1')).toBe(true)
    expect(isAgentWorkspaceKnowledgeDetailPath('/agent-workspace/knowledge')).toBe(false)
    expect(isAgentWorkspaceKnowledgeDetailPath('/agent-workspace/knowledge/')).toBe(false)
    expect(isAgentWorkspaceKnowledgeDetailPath('/agent-workspace')).toBe(false)
    expect(isAgentWorkspaceKnowledgeDetailPath('/agent-workspace/knowledge/nb-1/extra')).toBe(false)
  })
})

describe('getMainPageCacheKey for knowledge', () => {
  it('keeps the notebook list in the workbench cache and opens detail in the outlet', () => {
    expect(getMainPageCacheKey('/agent-workspace/knowledge')).toBe('/agent-workspace')
    expect(getMainPageCacheKey('/agent-workspace/knowledge/nb-1')).toBeNull()
    expect(getMainPageCacheKey('/agent-workspace/open/ws-1')).toBe('/agent-workspace')
  })
})
