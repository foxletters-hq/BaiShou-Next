import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))

function read(rel: string): string {
  return readFileSync(join(here, rel), 'utf8')
}

describe('auto inject time enable confirm', () => {
  it('should confirm before enabling auto inject time in companion chat tools', () => {
    const pane = read('../CompanionChatToolsPane.tsx')
    expect(pane).toContain('isEnablingAutoInjectTime')
    expect(pane).toContain('auto_inject_time_enable_confirm')
    expect(pane).toContain('dialog.confirm')
  })

  it('should not keep a separate always-allow list in companion chat tools', () => {
    const pane = read('../CompanionChatToolsPane.tsx')
    const companionForm = read('../AgentGateCompanionForm.tsx')
    expect(pane).not.toContain('settings.agent_gate_allowlist_title')
    expect(companionForm).not.toContain('settings.agent_gate_allowlist_title')
  })
})
