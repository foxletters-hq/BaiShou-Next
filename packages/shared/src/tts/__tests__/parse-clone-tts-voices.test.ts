import { describe, it, expect } from 'vitest'
import { parseCloneTtsVoiceList } from '../fetch-tts-models'

describe('parseCloneTtsVoiceList', () => {
  it('parses top-level voice objects', () => {
    expect(
      parseCloneTtsVoiceList([
        { alias: 'voice-a', name: 'A' },
        { name: 'voice-b' },
        { id: 'voice-c' }
      ])
    ).toEqual(['voice-a', 'voice-b', 'voice-c'])
  })

  it('parses wrapped voices arrays', () => {
    expect(
      parseCloneTtsVoiceList({
        voices: [{ alias: 'a' }, { alias: 'b' }, { alias: 'c' }]
      })
    ).toEqual(['a', 'b', 'c'])
  })

  it('disambiguates duplicate voice ids instead of dropping them', () => {
    expect(parseCloneTtsVoiceList(['a', 'b', 'a', '  c  '])).toEqual(['a', 'b', 'a (2)', 'c'])
  })

  it('keeps duplicate aliases visible for selection', () => {
    expect(
      parseCloneTtsVoiceList([
        { alias: 'default', path: '/voices/a' },
        { alias: 'default', path: '/voices/b' },
        { alias: 'default', path: '/voices/c' }
      ])
    ).toEqual(['default', 'default (2)', 'default (3)'])
  })

  it('returns empty array for unsupported payloads', () => {
    expect(parseCloneTtsVoiceList(null)).toEqual([])
    expect(parseCloneTtsVoiceList({ ok: true })).toEqual([])
  })
})
