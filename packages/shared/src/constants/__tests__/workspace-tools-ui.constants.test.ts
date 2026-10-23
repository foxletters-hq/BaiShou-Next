import { describe, expect, it } from 'vitest'
import { WORKSPACE_TOOL_UI_DEFS, AGENT_TOOL_UI_DEFS } from '../agent-tools-ui.constants'

describe('workspace tool UI defs', () => {
  it('lists workspace tools without diary tools', () => {
    const ids = WORKSPACE_TOOL_UI_DEFS.map((tool) => tool.id)
    expect(ids).toContain('workspace_list')
    expect(ids).toContain('workspace_run')
    expect(ids).toContain('companion_ask')
    expect(ids).not.toContain('diary_write')
    expect(ids).not.toContain('emoji_send')
  })

  it('keeps companion catalog free of workspace_* tools', () => {
    const ids = AGENT_TOOL_UI_DEFS.map((tool) => tool.id)
    expect(ids.some((id) => id.startsWith('workspace_'))).toBe(false)
    expect(ids).toContain('diary_write')
  })
})
