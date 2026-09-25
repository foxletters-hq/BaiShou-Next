import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))

function read(rel: string): string {
  return readFileSync(join(here, rel), 'utf8')
}

describe('agent composer chrome', () => {
  it('should keep the model switcher on the right and hide the usage ring before any messages', () => {
    const screen = read('../AgentScreen.tsx')
    const css = read('../AgentScreen.module.css')
    expect(css).toContain('justify-content: space-between')
    expect(css).toContain('margin-left: auto')
    expect(screen).toContain('metaTrailing')
    expect(screen).toContain('SessionContextUsageRing')
  })

  it('should allow mounting notebooks on a draft session and apply them when the session is created', () => {
    const screen = read('../AgentScreen.tsx')
    const flow = read('../hooks/useAgentChatFlow.ts')
    const mount = read('../../knowledge/useNotebookMount.ts')
    const dialog = read('../../agent-workspace/workbench/WorkbenchNotebookMountDialog.tsx')
    expect(screen).toContain("get('focus') !== 'notebook-mount'")
    expect(screen).toContain('scope="companion"')
    expect(flow).toContain('applyPendingNotebookMountToSession')
    expect(mount).toContain('isDraftNotebookMountSessionId')
    expect(mount).toContain('setPendingMountedNotebookIds')
    expect(dialog).toContain('Checkbox')
    expect(dialog).not.toContain('请先打开一个会话')
  })

  it('should refresh the gate inbox when companion_ask is waiting without a dock', () => {
    const screen = read('../AgentScreen.tsx')
    expect(screen).toContain('refreshDesktopAgentGateInbox')
    expect(screen).toContain('askingCallIds')
    expect(screen).toContain('setInterval')
  })

  it('should rebuild the ask card from live timeline arguments instead of caching the array reference', () => {
    const screen = read('../AgentScreen.tsx')
    expect(screen).toContain('resolveCompanionAskDockRequest')
    expect(screen).toContain('waitForLiveCompanionAskRequest')
    expect(screen).not.toContain('[flow.sessionId, flow.stream.timeline, pendingGate]')
  })
})
