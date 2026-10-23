import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const dir = dirname(fileURLToPath(import.meta.url))
const drawerSrc = readFileSync(join(dir, '../AgentGatePendingDrawer.tsx'), 'utf8')
const drawerCss = readFileSync(join(dir, '../AgentGatePendingDrawer.module.css'), 'utf8')

describe('AgentGatePendingDrawer chrome', () => {
  it('should resolve workspace and session labels from name maps instead of raw ids', () => {
    expect(drawerSrc).toContain('lookupAgentGatePendingName')
    expect(drawerSrc).toContain('useAgentGatePendingNameMaps')
    expect(drawerSrc).toContain("t('agent_gate.group_workspace', '工作区 · {{name}}'")
    expect(drawerSrc).toContain("t('agent_gate.session_label', '会话 {{name}}'")
    expect(drawerSrc).not.toContain("t('agent_gate.group_workspace', '工作区 · {{id}}'")
  })

  it('should use the small outlined button so the badge matches the sync control height', () => {
    expect(drawerSrc).toContain('<Button')
    expect(drawerSrc).toContain('size="small"')
    expect(drawerSrc).toContain('variant="outlined"')
    expect(drawerCss).toContain('.badgeBtn')
    expect(drawerCss).not.toContain('padding: 4px 8px')
    expect(drawerCss).not.toContain('border-radius: 999px')
  })
})
