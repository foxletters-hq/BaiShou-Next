import type { TFunction } from 'i18next'
import { describe, expect, it } from 'vitest'
import {
  AGENT_TOOL_UI_DEFS,
  resolveAgentToolActionLabel,
  resolveAgentToolNameKey
} from '../agent-tools-ui.constants'
import { AGENT_BUILTIN_TOOL_IDS } from '../agent-builtin-tool-ids.constants'

describe('agent-tools-ui.constants', () => {
  it('includes diary write and web tools for tool management UI', () => {
    const ids = AGENT_TOOL_UI_DEFS.map((tool) => tool.id)
    expect(ids).toContain('diary_write')
    expect(ids).toContain('web_search')
    expect(ids).toContain('url_read')
    expect(ids).toContain('current_time')
    expect(ids).toContain('skill_write')
  })

  it('keeps auto_inject_time UI-only and out of builtin tool ids', () => {
    expect(AGENT_TOOL_UI_DEFS.some((tool) => tool.id === 'auto_inject_time')).toBe(true)
    expect(AGENT_BUILTIN_TOOL_IDS).not.toContain('auto_inject_time')
    expect(AGENT_BUILTIN_TOOL_IDS).toContain('diary_write')
    expect(AGENT_BUILTIN_TOOL_IDS).toContain('skill_write')
  })
})

describe('resolveAgentToolActionLabel', () => {
  it('maps builtin actions to agent.tools.<id> and translates the display name', () => {
    expect(resolveAgentToolNameKey('recall_relations')).toBe('agent.tools.recall_relations')
    expect(resolveAgentToolNameKey('graph_upsert')).toBe('agent.tools.graph_upsert')
    expect(resolveAgentToolNameKey('workspace_run')).toBe('agent.tools.workspace_run')

    const t = (key: string, fallback?: string) =>
      key === 'agent.tools.recall_relations' ? '回忆关系图谱' : (fallback ?? key)
    expect(resolveAgentToolActionLabel('recall_relations', t)).toBe('回忆关系图谱')
  })

  it('falls back to the raw action for unknown tools', () => {
    expect(resolveAgentToolNameKey('totally_unknown_tool')).toBe('agent.tools.totally_unknown_tool')
    const t = (_key: string, fallback?: string) => fallback ?? _key
    expect(resolveAgentToolActionLabel('totally_unknown_tool', t)).toBe('totally_unknown_tool')
  })

  it('shows baishou_<tool> without the server UUID', () => {
    const t = (_key: string, fallback?: string) => fallback ?? _key
    expect(
      resolveAgentToolActionLabel('mcp_401e4719_6331_42be_a21c__baishou_summary_read', t)
    ).toBe('baishou_summary_read')
  })

  it('should accept TFunction at the type level when resolving a label', () => {
    const resolveWithTFunction: (t: TFunction) => string = (t) =>
      resolveAgentToolActionLabel('web_search', t)
    expect(typeof resolveWithTFunction).toBe('function')
  })
})
