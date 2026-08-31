import { describe, expect, it } from 'vitest'
import { graphNodeIdForEntity } from '../graph-identity.util'
import {
  notebookGraphEdgeId,
  notebookGraphNodeIdForEntity,
  shouldKeepIncomingNotebookGraphNodeId
} from '../notebook-graph-identity.util'

describe('notebookGraph identity', () => {
  it('same name differs across notebooks', () => {
    const a = notebookGraphNodeIdForEntity('vlt_a', 'nb1', 'person', '小明')
    const b = notebookGraphNodeIdForEntity('vlt_a', 'nb2', 'person', '小明')
    expect(a).not.toBe(b)
  })

  it('does not collide with diary entity id', () => {
    const diary = graphNodeIdForEntity('vlt_a', 'person', '小明')
    const nb = notebookGraphNodeIdForEntity('vlt_a', 'nb1', 'person', '小明')
    expect(nb).not.toBe(diary)
  })

  it('edge id includes notebook salt', () => {
    const a = notebookGraphEdgeId('vlt_a', 'nb1', 'n1', 'n2', 'relates_to', 'src1')
    const b = notebookGraphEdgeId('vlt_a', 'nb2', 'n1', 'n2', 'relates_to', 'src1')
    expect(a).not.toBe(b)
  })

  it('shouldKeepIncomingNotebookGraphNodeId keeps the content-addressable id', () => {
    const stable = notebookGraphNodeIdForEntity('vlt_a', 'nb1', 'person', '小明')
    expect(
      shouldKeepIncomingNotebookGraphNodeId({
        vaultId: 'vlt_a',
        notebookId: 'nb1',
        nodeType: 'person',
        name: '小明',
        incomingId: stable,
        existingId: 'legacy-random'
      })
    ).toBe(true)
    expect(
      shouldKeepIncomingNotebookGraphNodeId({
        vaultId: 'vlt_a',
        notebookId: 'nb1',
        nodeType: 'person',
        name: '小明',
        incomingId: 'legacy-random',
        existingId: stable
      })
    ).toBe(false)
  })
})
