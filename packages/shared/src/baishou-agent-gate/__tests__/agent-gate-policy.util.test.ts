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

  it('deduplicates merged resources', () => {
    expect(
      mergeAgentGateResources(
        [{ kind: 'workspace_path', value: 'src/foo.ts' }],
        [{ kind: 'workspace_path', value: 'src/foo.ts' }]
      )
    ).toEqual([{ kind: 'workspace_path', value: 'src/foo.ts' }])
  })
})
