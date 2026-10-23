import { describe, expect, it } from 'vitest'
import { extractFirstJsonObject, parseExtractJson } from '../graph-llm-extraction.prompt'

describe('parseExtractJson', () => {
  it('should return entities and edges when the model wraps JSON in prose', () => {
    const parsed = parseExtractJson(
      '好的\n{"entities":[{"name":"小明","type":"person"}],"edges":[{"from":"小明","to":"日记","type":"mentions"}]}\n结束'
    )
    expect(parsed?.entities).toEqual([{ name: '小明', type: 'person' }])
    expect(parsed?.edges).toHaveLength(1)
  })

  it('should return null when the text has no JSON object', () => {
    expect(parseExtractJson('没有结构化输出')).toBeNull()
  })

  it('should treat missing arrays as empty when JSON is otherwise valid', () => {
    const parsed = parseExtractJson('{"ok":true}')
    expect(parsed).toEqual({ entities: [], edges: [] })
  })
})

describe('extractFirstJsonObject', () => {
  it('should pick the first object when the reply contains extra text', () => {
    expect(extractFirstJsonObject('prefix {"a":1} suffix')).toBe('{"a":1}')
  })
})
