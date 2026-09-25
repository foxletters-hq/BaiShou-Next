import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const src = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'AgentWorkspaceMessageList.tsx'),
  'utf8'
)

describe('workspace gate cards chrome', () => {
  it('should render workspace-scoped gate cards on the workbench message list', () => {
    expect(src).toContain('AgentGatePartBubble')
    expect(src).toContain("selectResolvedLiveForSession(state, sessionId, 'workspace')")
    expect(src).toContain("collectAgentGatePartDataForSurface(msg.parts, 'workspace')")
    expect(src).not.toContain("'companion'")
  })

  it('should open the clicked write preview in the workbench editor', () => {
    const shell = readFileSync(
      join(
        dirname(fileURLToPath(import.meta.url)),
        '..',
        '..',
        'workbench',
        'WorkbenchShell.tsx'
      ),
      'utf8'
    )
    expect(shell).toContain('workspaceChangeFromGatePreview')
    expect(shell).toContain('onOpenGateFileChange')
    expect(shell).not.toContain('openDiffs(changes)')
  })

  it('should pass pending write previews into the streaming file list', () => {
    const stream = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '..', 'WorkspaceStreamingTurn.tsx'),
      'utf8'
    )
    expect(stream).toContain('workspaceChangesFromGateRequest')
    expect(stream).toContain('mergeWorkspaceChangeEntries')
    expect(stream).toContain('pendingAsk')
  })
})
