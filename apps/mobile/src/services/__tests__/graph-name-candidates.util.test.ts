import { describe, expect, it } from 'vitest'
import {
  listRegisteredSameNameEntities,
  parseGraphNodePropsJson,
  pickBareGraphNameHit
} from '../graph-name-candidates.util'

describe('pickBareGraphNameHit', () => {
  it('should return null and not mark ambiguous when the lookup has zero rows', () => {
    expect(pickBareGraphNameHit([])).toEqual({ hit: null, ambiguous: false })
  })

  it('should return the only row and not mark ambiguous when the lookup has one row', () => {
    const only = { id: 'bare', discriminator: '' }
    expect(pickBareGraphNameHit([only])).toEqual({ hit: only, ambiguous: false })
  })

  it('should pick the bare-name row and mark ambiguous when several same-name rows exist', () => {
    const bare = { id: 'bare', discriminator: '' }
    const split = { id: 'split', discriminator: '同事' }
    expect(pickBareGraphNameHit([bare, split])).toEqual({ hit: bare, ambiguous: true })
  })
})

describe('listRegisteredSameNameEntities', () => {
  it('should list registered split entities when the current node is the bare name', () => {
    const listed = listRegisteredSameNameEntities({
      currentId: 'bare',
      currentName: '张三',
      currentDiscriminator: '',
      currentProps: {
        nameRegistry: [
          { discriminator: '同事', label: '同事', nodeId: 'split-work', registeredAt: 1 }
        ]
      }
    })
    expect(listed).toEqual([
      { nodeId: 'split-work', name: '张三', discriminator: '同事', label: '同事' }
    ])
    expect(listed[0]?.name).toBe('张三')
    expect(listed[0]?.name.includes('同事')).toBe(false)
  })

  it('should include the bare-name node when the current node is a registered split', () => {
    const listed = listRegisteredSameNameEntities({
      currentId: 'split-work',
      currentName: '张三',
      currentDiscriminator: '同事',
      currentProps: {},
      bareNode: {
        id: 'bare',
        props: {
          nameRegistry: [
            { discriminator: '同事', label: '同事', nodeId: 'split-work', registeredAt: 1 },
            { discriminator: '同学', label: '小学同学', nodeId: 'split-school', registeredAt: 2 }
          ]
        }
      }
    })
    expect(listed).toEqual([
      { nodeId: 'bare', name: '张三', discriminator: '', label: '' },
      { nodeId: 'split-school', name: '张三', discriminator: '同学', label: '小学同学' }
    ])
  })
})

describe('parseGraphNodePropsJson', () => {
  it('should return an empty object when props json is missing or invalid', () => {
    expect(parseGraphNodePropsJson(null)).toEqual({})
    expect(parseGraphNodePropsJson('{')).toEqual({})
  })
})
