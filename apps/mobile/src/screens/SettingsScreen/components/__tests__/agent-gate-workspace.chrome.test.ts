import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const dir = dirname(fileURLToPath(import.meta.url))
const section = [
  'AgentGateSettingsSection.tsx',
  'useAgentGateSettings.ts',
  'AgentGateProfileCard.tsx'
]
  .map((name) => readFileSync(join(dir, '..', name), 'utf8'))
  .join('\n')

describe('mobile agent gate workspace matrix', () => {
  it('should persist workspace security mode without a workbench entry', () => {
    expect(section).toContain('applyWorkspaceSecurityModeToConfig')
    expect(section).toContain('SegmentedControl')
    expect(section).toContain('agent.gate.workspace_mobile_hint')
    expect(section).not.toContain('workspace_run')
    expect(section).not.toContain('Workbench')
  })
})
