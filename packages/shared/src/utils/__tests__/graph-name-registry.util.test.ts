import { describe, expect, it } from 'vitest'
import {
  appendAmbiguousSourceRef,
  hasAmbiguousGraphName,
  listAmbiguousSourceRefs,
  normalizeGraphDiscriminator,
  readGraphNameRegistry,
  removeGraphNameRegistryEntry,
  upsertGraphNameRegistryEntry,
  type GraphNameRegistryEntry
} from '../graph-name-registry.util'

const ENTRY_WORK: GraphNameRegistryEntry = {
  discriminator: 'work',
  label: 'Work Colleague',
  nodeId: 'node-work',
  registeredAt: 100
}

const ENTRY_SCHOOL: GraphNameRegistryEntry = {
  discriminator: 'school',
  label: '小学同学',
  nodeId: 'node-school',
  registeredAt: 200
}

describe('normalizeGraphDiscriminator', () => {
  it('should trim collapse whitespace and lowercase when given raw text', () => {
    expect(normalizeGraphDiscriminator(' Work   Colleague ')).toBe('work colleague')
  })

  it('should return an empty string when the raw value is null or blank', () => {
    expect(normalizeGraphDiscriminator(null)).toBe('')
    expect(normalizeGraphDiscriminator(undefined)).toBe('')
    expect(normalizeGraphDiscriminator('   ')).toBe('')
  })
})

describe('readGraphNameRegistry', () => {
  it('should return an empty array when props has no registry', () => {
    expect(readGraphNameRegistry({})).toEqual([])
  })

  it('should return an empty array when nameRegistry is a string', () => {
    expect(readGraphNameRegistry({ nameRegistry: '[{"discriminator":"work"}]' })).toEqual([])
  })

  it('should skip non-object items when nameRegistry mixes invalid entries', () => {
    expect(
      readGraphNameRegistry({
        nameRegistry: [
          'bad',
          ENTRY_WORK,
          12,
          null,
          { discriminator: 'school', label: '小学同学', nodeId: 'node-school' },
          { discriminator: 'x', label: 'X', nodeId: 'n', registeredAt: '1' }
        ]
      })
    ).toEqual([ENTRY_WORK])
  })
})

describe('upsertGraphNameRegistryEntry', () => {
  it('should overwrite the existing item when discriminator already exists', () => {
    const next = upsertGraphNameRegistryEntry({ nameRegistry: [ENTRY_WORK, ENTRY_SCHOOL] }, {
      discriminator: 'WORK',
      label: '公司同事',
      nodeId: 'node-work-2',
      registeredAt: 300
    })
    expect(readGraphNameRegistry(next)).toEqual([
      {
        discriminator: 'work',
        label: '公司同事',
        nodeId: 'node-work-2',
        registeredAt: 300
      },
      ENTRY_SCHOOL
    ])
  })

  it('should keep other props keys when inserting the first registry entry', () => {
    const next = upsertGraphNameRegistryEntry({ keep: true }, ENTRY_WORK)
    expect(next.keep).toBe(true)
    expect(readGraphNameRegistry(next)).toEqual([ENTRY_WORK])
  })
})

describe('removeGraphNameRegistryEntry', () => {
  it('should drop the nameRegistry key when the last entry is removed', () => {
    const next = removeGraphNameRegistryEntry({ keep: true, nameRegistry: [ENTRY_WORK] }, ' WORK ')
    expect(next).toEqual({ keep: true })
    expect(Object.prototype.hasOwnProperty.call(next, 'nameRegistry')).toBe(false)
  })

  it('should keep remaining entries when only one discriminator is removed', () => {
    const next = removeGraphNameRegistryEntry(
      { nameRegistry: [ENTRY_WORK, ENTRY_SCHOOL] },
      'work'
    )
    expect(readGraphNameRegistry(next)).toEqual([ENTRY_SCHOOL])
  })
})

describe('hasAmbiguousGraphName', () => {
  it('should return false when the registry has zero entries', () => {
    expect(hasAmbiguousGraphName({})).toBe(false)
  })

  it('should return true when the registry has one entry', () => {
    expect(hasAmbiguousGraphName({ nameRegistry: [ENTRY_WORK] })).toBe(true)
  })
})

describe('listAmbiguousSourceRefs', () => {
  it('should return an empty array when the key is missing or mistyped', () => {
    expect(listAmbiguousSourceRefs({})).toEqual([])
    expect(listAmbiguousSourceRefs({ ambiguousSourceRefs: 'src-1' })).toEqual([])
  })

  it('should skip non-string items when ambiguousSourceRefs mixes invalid entries', () => {
    expect(
      listAmbiguousSourceRefs({
        ambiguousSourceRefs: ['src-1', 2, null, 'src-2']
      })
    ).toEqual(['src-1', 'src-2'])
  })
})

describe('appendAmbiguousSourceRef', () => {
  it('should keep the first write order when the same sourceRef is appended again', () => {
    const once = appendAmbiguousSourceRef({ ambiguousSourceRefs: ['src-b'] }, 'src-a')
    const twice = appendAmbiguousSourceRef(once, 'src-b')
    expect(listAmbiguousSourceRefs(twice)).toEqual(['src-b', 'src-a'])
  })

  it('should drop the earliest sourceRef when the list exceeds 200 items', () => {
    const refs = Array.from({ length: 200 }, (_, index) => `src-${index}`)
    const next = appendAmbiguousSourceRef({ ambiguousSourceRefs: refs }, 'src-new')
    const listed = listAmbiguousSourceRefs(next)
    expect(listed).toHaveLength(200)
    expect(listed[0]).toBe('src-1')
    expect(listed[199]).toBe('src-new')
    expect(listed).not.toContain('src-0')
  })

  it('should return a shallow copy when sourceRef is blank', () => {
    const props = { keep: true }
    const next = appendAmbiguousSourceRef(props, '   ')
    expect(next).toEqual({ keep: true })
    expect(next).not.toBe(props)
    expect(Object.prototype.hasOwnProperty.call(next, 'ambiguousSourceRefs')).toBe(false)
  })
})

describe('graph-name-registry immutability', () => {
  it('should leave the incoming props object unchanged when any helper runs', () => {
    const props = {
      nameRegistry: [ENTRY_WORK],
      ambiguousSourceRefs: ['src-1']
    }
    const snapshot = structuredClone(props)
    readGraphNameRegistry(props)
    hasAmbiguousGraphName(props)
    listAmbiguousSourceRefs(props)
    upsertGraphNameRegistryEntry(props, ENTRY_SCHOOL)
    removeGraphNameRegistryEntry(props, 'work')
    appendAmbiguousSourceRef(props, 'src-2')
    expect(props).toEqual(snapshot)
  })
})
