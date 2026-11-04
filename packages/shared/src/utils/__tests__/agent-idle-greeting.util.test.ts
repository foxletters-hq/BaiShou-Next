import { describe, expect, it } from 'vitest'
import { UI_LOCALE_CATALOGS } from '../../i18n/locales/all-locales'
import {
  AGENT_IDLE_GREETING_FALLBACKS,
  AGENT_IDLE_GREETING_KEYS,
  pickAgentIdleGreetingIndex,
  splitAgentIdleGreetingLines
} from '../agent-idle-greeting.util'

function getAgentGreetings(
  catalog: (typeof UI_LOCALE_CATALOGS)[keyof typeof UI_LOCALE_CATALOGS]
): string[] {
  const agent = (catalog as unknown as { agent: Record<string, string> }).agent
  return AGENT_IDLE_GREETING_KEYS.map((key) => {
    const shortKey = key.replace(/^agent\./, '')
    const value = agent[shortKey]
    if (typeof value !== 'string') {
      throw new Error(`missing ${key} in catalog`)
    }
    return value.replaceAll('{{name}}', '你')
  })
}

describe('pickAgentIdleGreetingIndex', () => {
  it('should stay at zero when there is only one greeting', () => {
    expect(pickAgentIdleGreetingIndex(1)).toBe(0)
  })

  it('should avoid the previous index when length is greater than one', () => {
    for (let i = 0; i < 20; i += 1) {
      expect(pickAgentIdleGreetingIndex(10, 3)).not.toBe(3)
    }
  })
})

describe('splitAgentIdleGreetingLines', () => {
  it('should keep a clause without a terminator as a single line', () => {
    expect(splitAgentIdleGreetingLines('来吧，随便说说今天的感受')).toEqual([
      '来吧，随便说说今天的感受'
    ])
  })

  it('should split after a question mark and keep the mark on the first line', () => {
    expect(splitAgentIdleGreetingLines('今天心情如何？我在这儿听你说')).toEqual([
      '今天心情如何？',
      '我在这儿听你说'
    ])
  })

  it('should split after a period and keep the mark on the first line', () => {
    expect(splitAgentIdleGreetingLines('来吧。随便说说今天的感受')).toEqual([
      '来吧。',
      '随便说说今天的感受'
    ])
  })

  it('should drop an empty trailing piece after a terminal mark', () => {
    expect(splitAgentIdleGreetingLines('想跟我聊聊吗？')).toEqual(['想跟我聊聊吗？'])
  })

  it('should split every default fallback into at least two lines', () => {
    for (const fallback of AGENT_IDLE_GREETING_FALLBACKS) {
      const lines = splitAgentIdleGreetingLines(fallback.replaceAll('{{name}}', '你'))
      expect(lines.length).toBeGreaterThanOrEqual(2)
    }
  })

  it('should split every localized idle greeting into at least two lines', () => {
    for (const catalog of Object.values(UI_LOCALE_CATALOGS)) {
      for (const greeting of getAgentGreetings(catalog)) {
        expect(splitAgentIdleGreetingLines(greeting).length).toBeGreaterThanOrEqual(2)
      }
    }
  })
})
