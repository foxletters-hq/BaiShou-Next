import { describe, expect, it } from 'vitest'
import { graphNodeIdForEntity } from '../graph-identity.util'
import {
  notebookGraphEdgeId,
  notebookGraphNodeIdForEntity,
  notebookGraphSourceNodeId,
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

describe('notebookGraphNodeIdForEntity discriminator', () => {
  // 改动前对 vault-1 / nb-1 / person / 张三 算出的字面量；禁止改成「两次调用互比」
  const LEGACY_NOTEBOOK_ZHANG_SAN_ID = '65abe28a-6752-5a5a-a169-b0e75f41ed9f'
  const LEGACY_NOTEBOOK_SOURCE_ID = '2e21af2e-496e-5da4-a774-d9a65633859c'

  it('should keep the hardcoded legacy id when the fifth argument is omitted', () => {
    expect(notebookGraphNodeIdForEntity('vault-1', 'nb-1', 'person', '张三')).toBe(
      LEGACY_NOTEBOOK_ZHANG_SAN_ID
    )
  })

  it('should keep the hardcoded legacy id when discriminator is undefined', () => {
    expect(notebookGraphNodeIdForEntity('vault-1', 'nb-1', 'person', '张三', undefined)).toBe(
      LEGACY_NOTEBOOK_ZHANG_SAN_ID
    )
  })

  it('should keep the hardcoded legacy id when discriminator is an empty string', () => {
    expect(notebookGraphNodeIdForEntity('vault-1', 'nb-1', 'person', '张三', '')).toBe(
      LEGACY_NOTEBOOK_ZHANG_SAN_ID
    )
  })

  it('should keep the hardcoded legacy id when discriminator is only whitespace', () => {
    expect(notebookGraphNodeIdForEntity('vault-1', 'nb-1', 'person', '张三', '   ')).toBe(
      LEGACY_NOTEBOOK_ZHANG_SAN_ID
    )
  })

  it('should differ from the bare-name id when discriminator is non-empty', () => {
    expect(notebookGraphNodeIdForEntity('vault-1', 'nb-1', 'person', '张三', '同事')).not.toBe(
      LEGACY_NOTEBOOK_ZHANG_SAN_ID
    )
  })

  it('should produce the same id when discriminator only differs by case or whitespace', () => {
    const a = notebookGraphNodeIdForEntity('vault-1', 'nb-1', 'person', '张三', 'Work Colleague')
    const b = notebookGraphNodeIdForEntity('vault-1', 'nb-1', 'person', '张三', ' work   colleague ')
    const c = notebookGraphNodeIdForEntity('vault-1', 'nb-1', 'person', '张三', 'WORK COLLEAGUE')
    expect(a).toBe(b)
    expect(a).toBe(c)
    expect(a).not.toBe(LEGACY_NOTEBOOK_ZHANG_SAN_ID)
  })

  it('should keep the hardcoded legacy source id when source helper omits discriminator', () => {
    expect(notebookGraphSourceNodeId('vault-1', 'nb-1', 'src-1')).toBe(LEGACY_NOTEBOOK_SOURCE_ID)
  })
})

describe('shouldKeepIncomingNotebookGraphNodeId discriminator', () => {
  it('should prefer the content-derived id when a discriminator is provided', () => {
    const stable = notebookGraphNodeIdForEntity('vault-1', 'nb-1', 'person', '张三', '同事')
    expect(
      shouldKeepIncomingNotebookGraphNodeId({
        vaultId: 'vault-1',
        notebookId: 'nb-1',
        nodeType: 'person',
        name: '张三',
        discriminator: '同事',
        incomingId: stable,
        existingId: 'legacy-random'
      })
    ).toBe(true)
    expect(
      shouldKeepIncomingNotebookGraphNodeId({
        vaultId: 'vault-1',
        notebookId: 'nb-1',
        nodeType: 'person',
        name: '张三',
        discriminator: '同事',
        incomingId: 'legacy-random',
        existingId: stable
      })
    ).toBe(false)
  })
})
