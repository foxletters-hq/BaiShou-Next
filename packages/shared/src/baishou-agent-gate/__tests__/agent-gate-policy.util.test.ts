import { describe, expect, it } from 'vitest'
import {
  canPermanentlyAllowAgentGateAction,
  DEFAULT_AGENT_GATE_EXCLUSION_LIST,
  extractAgentGateResourcesFromMetadata,
  isAgentGateActionForceExcluded,
  mergeAgentGateResources
} from '@baishou/shared'

describe('agent-gate-policy.util', () => {
  it('treats default exclusion actions as force excluded', () => {
    for (const action of DEFAULT_AGENT_GATE_EXCLUSION_LIST) {
      expect(isAgentGateActionForceExcluded(action)).toBe(true)
      expect(canPermanentlyAllowAgentGateAction(action)).toBe(false)
    }
  })

  it('blocks always allow when metadata.forceExclusion is true', () => {
    expect(
      canPermanentlyAllowAgentGateAction('custom_action', {
        exclusionList: [],
        metadata: { forceExclusion: true }
      })
    ).toBe(false)
  })

  it('allows always allow for normal mutating actions', () => {
    expect(canPermanentlyAllowAgentGateAction('diary_edit')).toBe(true)
  })

  it('blocks always allow for external_path resources', () => {
    expect(
      canPermanentlyAllowAgentGateAction('workspace_write', {
        exclusionList: [],
        resources: [{ kind: 'external_path', value: 'C:/Outside/x.txt' }]
      })
    ).toBe(false)
  })

  it('extracts workspace paths from metadata', () => {
    expect(
      extractAgentGateResourcesFromMetadata({
        path: 'src/foo.ts',
        new_path: 'src/bar.ts'
      })
    ).toEqual([
      { kind: 'workspace_path', value: 'src/foo.ts' },
      { kind: 'workspace_path', value: 'src/bar.ts' }
    ])
  })

  it('extracts nested metadata.resources and dedupes with field paths', () => {
    expect(
      extractAgentGateResourcesFromMetadata({
        shellCommand: 'git status',
        resources: [
          { kind: 'shell_command', value: 'git status' },
          { kind: 'shell_command', value: 'npm test' },
          { kind: 'nope', value: 'x' },
          'bad'
        ]
      })
    ).toEqual([
      { kind: 'shell_command', value: 'git status' },
      { kind: 'shell_command', value: 'npm test' }
    ])
  })

  it('deduplicates merged resources', () => {
    expect(
      mergeAgentGateResources(
        [{ kind: 'workspace_path', value: 'src/foo.ts' }],
        [{ kind: 'workspace_path', value: 'src/foo.ts' }]
      )
    ).toEqual([{ kind: 'workspace_path', value: 'src/foo.ts' }])
  })
})
