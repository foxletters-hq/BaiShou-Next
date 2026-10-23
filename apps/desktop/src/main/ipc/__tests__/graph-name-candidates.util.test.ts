import { describe, expect, it } from 'vitest'
import { toNameCandidate } from '../graph-name-candidates.util'

describe('toNameCandidate', () => {
  it('should use explicit label when it is non-empty', () => {
    expect(
      toNameCandidate({ id: 'n1', name: '张三', discriminator: '同事' }, '  小学同学  ')
    ).toEqual({
      nodeId: 'n1',
      name: '张三',
      discriminator: '同事',
      label: '小学同学'
    })
  })

  it('should fall back to discriminator when label is blank', () => {
    expect(toNameCandidate({ id: 'n1', name: '张三', discriminator: '同事' }, '   ')).toEqual({
      nodeId: 'n1',
      name: '张三',
      discriminator: '同事',
      label: '同事'
    })
  })

  it('should fall back to name when discriminator is missing', () => {
    expect(toNameCandidate({ id: 'n1', name: '张三' })).toEqual({
      nodeId: 'n1',
      name: '张三',
      discriminator: '',
      label: '张三'
    })
  })
})
