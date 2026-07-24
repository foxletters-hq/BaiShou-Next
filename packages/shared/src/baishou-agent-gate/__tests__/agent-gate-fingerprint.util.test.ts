import { describe, expect, it } from 'vitest'
import {
  agentGateSimpleHash,
  buildAgentGateAssertFingerprint
} from '../agent-gate-fingerprint.util'

describe('buildAgentGateAssertFingerprint', () => {
  it('hashes memory preview content', () => {
    const a = buildAgentGateAssertFingerprint({
      action: 'memory_store',
      metadata: { preview: 'hello world' }
    })
    const b = buildAgentGateAssertFingerprint({
      action: 'memory_store',
      metadata: { preview: 'hello world' }
    })
    const c = buildAgentGateAssertFingerprint({
      action: 'memory_store',
      metadata: { preview: 'other' }
    })
    expect(a).toBe(b)
    expect(a).not.toBe(c)
    expect(a).toContain(agentGateSimpleHash('hello world'))
  })

  it('uses diary date and mode', () => {
    expect(
      buildAgentGateAssertFingerprint({
        action: 'diary_edit',
        metadata: { date: '2026-07-17', mode: 'append' }
      })
    ).toBe('diary_edit::2026-07-17::append')
  })

  it('includes workspace resources', () => {
    const fingerprint = buildAgentGateAssertFingerprint({
      action: 'workspace_write',
      metadata: { path: 'src/a.ts' },
      resources: [{ kind: 'workspace_path', value: 'src/a.ts' }]
    })
    expect(fingerprint).toContain('workspace_path:src/a.ts')
  })

  it('distinguishes same path with different preview digests', () => {
    const a = buildAgentGateAssertFingerprint({
      action: 'workspace_write',
      metadata: { path: 'src/a.ts' },
      resources: [{ kind: 'workspace_path', value: 'src/a.ts' }],
      preview: {
        type: 'file_change',
        path: 'src/a.ts',
        kind: 'modify',
        additions: 1,
        deletions: 0,
        contentDigest: 'aaa'
      }
    })
    const b = buildAgentGateAssertFingerprint({
      action: 'workspace_write',
      metadata: { path: 'src/a.ts' },
      resources: [{ kind: 'workspace_path', value: 'src/a.ts' }],
      preview: {
        type: 'file_change',
        path: 'src/a.ts',
        kind: 'modify',
        additions: 2,
        deletions: 1,
        contentDigest: 'bbb'
      }
    })
    expect(a).not.toBe(b)
  })
})
