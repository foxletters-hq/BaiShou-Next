import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  AGENT_IDLE_GREETING_FALLBACKS,
  AGENT_IDLE_GREETING_KEYS,
  pickAgentIdleGreetingIndex,
  splitAgentIdleGreetingLines
} from '../agent-idle-greeting.util'

const i18nDir = join(dirname(fileURLToPath(import.meta.url)), '../../i18n')

function readAgentGreetings(fileName: string): string[] {
  const json = JSON.parse(readFileSync(join(i18nDir, fileName), 'utf8')) as {
    agent: Record<string, string>
  }
  return AGENT_IDLE_GREETING_KEYS.map((key) => {
    const shortKey = key.replace(/^agent\./, '')
    const value = json.agent[shortKey]
    if (typeof value !== 'string') {
      throw new Error(`missing ${key} in ${fileName}`)
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
    for (const fileName of ['zh.i18n.json', 'zh_TW.i18n.json', 'en.i18n.json', 'ja.i18n.json']) {
      for (const greeting of readAgentGreetings(fileName)) {
        expect(splitAgentIdleGreetingLines(greeting).length).toBeGreaterThanOrEqual(2)
      }
    }
  })
})
