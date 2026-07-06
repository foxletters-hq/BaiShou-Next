import { describe, expect, it } from 'vitest'
import { AGENT_TOOL_UI_DEFS } from '../agent-tools-ui.constants'
import { AGENT_BUILTIN_TOOL_IDS } from '../agent-builtin-tool-ids.constants'

describe('agent-tools-ui.constants', () => {
  it('includes diary write and web tools for tool management UI', () => {
    const ids = AGENT_TOOL_UI_DEFS.map((tool) => tool.id)
    expect(ids).toContain('diary_write')
    expect(ids).toContain('web_search')
    expect(ids).toContain('url_read')
    expect(ids).toContain('current_time')
  })

  it('keeps auto_inject_time UI-only and out of builtin tool ids', () => {
    expect(AGENT_TOOL_UI_DEFS.some((tool) => tool.id === 'auto_inject_time')).toBe(true)
    expect(AGENT_BUILTIN_TOOL_IDS).not.toContain('auto_inject_time')
    expect(AGENT_BUILTIN_TOOL_IDS).toContain('diary_write')
  })
})
