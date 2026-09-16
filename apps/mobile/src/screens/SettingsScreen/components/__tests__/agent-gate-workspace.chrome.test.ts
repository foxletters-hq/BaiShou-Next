import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const section = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'AgentGateSettingsSection.tsx'),
  'utf8'
)

describe('mobile agent gate workspace matrix', () => {
  it('should persist workspace security mode without a workbench entry', () => {
    expect(section).toContain('applyWorkspaceSecurityModeToConfig')
    expect(section).toContain('SegmentedControl')
    expect(section).toContain('agent.gate.workspace_mobile_hint')
    expect(section).not.toContain('workspace_run')
    expect(section).not.toContain('Workbench')
  })
})
