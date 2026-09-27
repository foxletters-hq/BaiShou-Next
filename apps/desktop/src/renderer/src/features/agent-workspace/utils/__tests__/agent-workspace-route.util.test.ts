import { describe, expect, it } from 'vitest'
import { getMainPageCacheKey } from '../../../../layouts/MainPageCache'
import {
  isAgentWorkspaceEditorPath,
  isAgentWorkspaceKnowledgeDetailPath,
  resolveWorkbenchDirectoryNav
} from '../agent-workspace-route.util'

describe('isAgentWorkspaceKnowledgeDetailPath', () => {
  it('matches a notebook detail path and rejects the list and other workbench paths', () => {
    expect(isAgentWorkspaceKnowledgeDetailPath('/agent-workspace/knowledge/nb-1')).toBe(true)
    expect(isAgentWorkspaceKnowledgeDetailPath('/agent-workspace/knowledge')).toBe(false)
    expect(isAgentWorkspaceKnowledgeDetailPath('/agent-workspace/knowledge/')).toBe(false)
    expect(isAgentWorkspaceKnowledgeDetailPath('/agent-workspace')).toBe(false)
    expect(isAgentWorkspaceKnowledgeDetailPath('/agent-workspace/knowledge/nb-1/extra')).toBe(false)
  })
})

describe('isAgentWorkspaceEditorPath', () => {
  it('matches opened folder and session editor routes', () => {
    expect(isAgentWorkspaceEditorPath('/agent-workspace/open/ws-1')).toBe(true)
    expect(isAgentWorkspaceEditorPath('/agent-workspace/session-abc')).toBe(true)
  })

  it('rejects home, directory and knowledge routes', () => {
    expect(isAgentWorkspaceEditorPath('/agent-workspace')).toBe(false)
    expect(isAgentWorkspaceEditorPath('/agent-workspace/')).toBe(false)
    expect(isAgentWorkspaceEditorPath('/agent-workspace/knowledge')).toBe(false)
    expect(isAgentWorkspaceEditorPath('/agent-workspace/knowledge/nb-1')).toBe(false)
    expect(isAgentWorkspaceEditorPath('/agent-workspace/skills')).toBe(false)
    expect(isAgentWorkspaceEditorPath('/agent-workspace/projects')).toBe(false)
    expect(isAgentWorkspaceEditorPath('/chat')).toBe(false)
  })
})

describe('resolveWorkbenchDirectoryNav', () => {
  it('should highlight the directory section when the path is home, knowledge, skills or projects', () => {
    expect(resolveWorkbenchDirectoryNav('/agent-workspace')).toBe('home')
    expect(resolveWorkbenchDirectoryNav('/agent-workspace/knowledge')).toBe('knowledge')
    expect(resolveWorkbenchDirectoryNav('/agent-workspace/skills')).toBe('skills')
    expect(resolveWorkbenchDirectoryNav('/agent-workspace/templates')).toBe('skills')
    expect(resolveWorkbenchDirectoryNav('/agent-workspace/projects')).toBe('projects')
  })
})

describe('getMainPageCacheKey for knowledge', () => {
  it('keeps the notebook list in the workbench cache and opens detail in the outlet', () => {
    expect(getMainPageCacheKey('/agent-workspace/knowledge')).toBe('/agent-workspace')
    expect(getMainPageCacheKey('/agent-workspace/knowledge/nb-1')).toBeNull()
    expect(getMainPageCacheKey('/agent-workspace/open/ws-1')).toBe('/agent-workspace')
  })
})
