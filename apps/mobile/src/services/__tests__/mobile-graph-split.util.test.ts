import { describe, expect, it } from 'vitest'
import { toMobileNameCandidate } from '../mobile-graph-split'

describe('toMobileNameCandidate', () => {
  it('should use the provided label when it is not blank', () => {
    expect(
      toMobileNameCandidate({ id: 'n1', name: '张三', discriminator: '同事' }, '公司同事')
    ).toEqual({
      nodeId: 'n1',
      name: '张三',
      discriminator: '同事',
      label: '公司同事'
    })
  })

  it('should fall back to discriminator then name when the label is missing', () => {
    expect(toMobileNameCandidate({ id: 'n1', name: '张三', discriminator: '同事' })).toEqual({
      nodeId: 'n1',
      name: '张三',
      discriminator: '同事',
      label: '同事'
    })
    expect(toMobileNameCandidate({ id: 'n2', name: '张三' })).toEqual({
      nodeId: 'n2',
      name: '张三',
      discriminator: '',
      label: '张三'
    })
  })
})
