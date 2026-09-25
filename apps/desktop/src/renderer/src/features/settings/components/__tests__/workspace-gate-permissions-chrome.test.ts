import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const src = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'WorkspaceGatePermissionsPanel.tsx'),
  'utf8'
)

describe('WorkspaceGatePermissionsPanel chrome', () => {
  it('should let the user add remove edit and restore the command blacklist', () => {
    expect(src).toContain('onPatchConfig')
    expect(src).toContain('commandBlacklist')
    expect(src).toContain('common.add')
    expect(src).toContain('common.remove')
    expect(src).toContain('settings.reset_default')
    expect(src).toContain('variant="outlined"')
    expect(src).toContain('size="small"')
    expect(src).toContain('agent_gate_blacklist_edit')
  })
})
