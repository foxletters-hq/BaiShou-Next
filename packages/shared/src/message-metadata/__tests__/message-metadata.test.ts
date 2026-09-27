import { describe, it, expect } from 'vitest'
import {
  buildContextEncodingSystemPromptLines,
  injectModelMetadata,
  injectModelMetadataIntoAssistantParts,
  shouldWrapRoleForModel,
  wrapMessageBodyForModel
} from '..'

describe('buildContextEncodingSystemPromptLines', () => {
  it('should describe per-message time wrappers instead of a sidecar table', () => {
    const lines = buildContextEncodingSystemPromptLines().join('\n')
    expect(lines).toContain('<message-time>')
    expect(lines).toContain('<message-content>')
    expect(lines).not.toContain('same order as the messages below')
  })
})

describe('shouldWrapRoleForModel', () => {
  it('wraps all model context roles', () => {
    expect(shouldWrapRoleForModel('user')).toBe(true)
    expect(shouldWrapRoleForModel('assistant')).toBe(true)
    expect(shouldWrapRoleForModel('system')).toBe(true)
    expect(shouldWrapRoleForModel('tool')).toBe(true)
    expect(shouldWrapRoleForModel('other')).toBe(false)
  })
})

describe('injectModelMetadata', () => {
  const at = new Date(2026, 5, 15, 14, 30)

  it('wraps user string content', () => {
    expect(injectModelMetadata('你好', 'user', at)).toBe(wrapMessageBodyForModel('你好', at))
  })

  it('does not wrap when wrapMessageTime is false', () => {
    expect(injectModelMetadata('你好', 'user', at, { wrapMessageTime: false })).toBe('你好')
  })
})

describe('injectModelMetadataIntoAssistantParts', () => {
  const at = new Date(2026, 5, 15, 16, 0)

  it('wraps first visible text but not reasoning', () => {
    const result = injectModelMetadataIntoAssistantParts(
      [
        { type: 'reasoning', text: 'thinking' },
        { type: 'text', text: '回复正文' }
      ],
      at
    )
    expect(result[0]?.text).toBe('thinking')
    expect(result[1]?.text).toBe(wrapMessageBodyForModel('回复正文', at))
  })
})
