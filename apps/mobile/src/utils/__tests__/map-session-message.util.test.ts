import { describe, expect, it } from 'vitest'
import { mapSessionMessageFromDb } from '../map-session-message.util'
import {
  normalizeUnknownFileCiteRefs,
  parseUnknownFileCiteRefs,
  parseUnknownSkillCiteRefs
} from '../map-session-cite.util'

describe('parseUnknownSkillCiteRefs', () => {
  it('should drop non-array payloads and non-object items', () => {
    expect(parseUnknownSkillCiteRefs('x')).toBeUndefined()
    expect(parseUnknownSkillCiteRefs([{ command: '/foo', content: 'a' }, 1, null])).toEqual([
      { command: '/foo', content: 'a' }
    ])
  })
})

describe('parseUnknownFileCiteRefs', () => {
  it('should keep null and undefined so the shared normalizer can treat them as empty', () => {
    expect(parseUnknownFileCiteRefs(null)).toBeNull()
    expect(parseUnknownFileCiteRefs(undefined)).toBeUndefined()
    expect(normalizeUnknownFileCiteRefs({ relativePath: 'a.md' })).toEqual([])
  })

  it('should drop non-array payloads and keep only object-shaped items', () => {
    expect(parseUnknownFileCiteRefs('notes.md')).toBeUndefined()
    expect(
      parseUnknownFileCiteRefs([
        { relativePath: 'a.md', comment: 'see' },
        'skip',
        { relativePath: 'b.md', selection: { startLine: 2, endLine: 4 } }
      ])
    ).toEqual([
      { relativePath: 'a.md', comment: 'see' },
      { relativePath: 'b.md', selection: { startLine: 2, endLine: 4 } }
    ])
  })
})

describe('mapSessionMessageFromDb', () => {
  it('should map persisted fileRefs after validating unknown JSON', () => {
    const mapped = mapSessionMessageFromDb({
      id: 'm1',
      role: 'user',
      parts: [
        {
          type: 'text',
          data: {
            text: 'see notes',
            fileRefs: [{ relativePath: 'notes.md' }, { relativePath: '' }]
          }
        }
      ]
    })
    expect(mapped.fileRefs).toEqual([{ relativePath: 'notes.md' }])
  })

  it('should omit cites when persisted fileRefs are not an array', () => {
    const mapped = mapSessionMessageFromDb({
      id: 'm2',
      role: 'user',
      parts: [{ type: 'text', data: { text: 'hi', fileRefs: { relativePath: 'a.md' } } }]
    })
    expect(mapped.fileRefs).toBeUndefined()
  })
})
