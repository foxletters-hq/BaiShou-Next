import { describe, it, expect } from 'vitest'
import {
  isDiaryCmFromWebViewMessage,
  parseDiaryCmFromWebViewMessage,
  serializeDiaryCmToWebViewMessage,
  type DiaryCmFromWebViewMessage,
  type DiaryCmToWebViewMessage
} from '../types'

const sampleTheme = {
  isDark: false,
  textPrimary: '#111',
  textSecondary: '#666',
  bgEditor: '#fff',
  borderColor: '#ddd',
  primary: '#007aff',
  tagColors: ['#60A5FA', '#34D399', '#F59E0B', '#A78BFA'] as [string, string, string, string]
}

describe('parseDiaryCmFromWebViewMessage', () => {
  const cases: DiaryCmFromWebViewMessage[] = [
    { type: 'ready' },
    { type: 'change', payload: { content: 'hello\n\n![img](a.png | 300)' } },
    { type: 'selectionChange', payload: { start: 2, end: 5 } },
    { type: 'resolveUrlRequest', payload: { requestId: 'req-1', srcRaw: 'attachment/x.png' } },
    {
      type: 'imageAction',
      payload: { action: 'delete', from: 0, to: 20, srcRaw: 'attachment/x.png' }
    },
    {
      type: 'imagePreview',
      payload: { srcRaw: 'attachment/x.png', resolvedUrl: 'file:///x.png' }
    },
    { type: 'contentHeight', payload: { height: 420 } },
    { type: 'focus' },
    { type: 'blur' }
  ]

  it.each(cases)('parses valid $type message', (message) => {
    const raw = JSON.stringify(message)
    expect(parseDiaryCmFromWebViewMessage(raw)).toEqual(message)
  })

  it('returns null for invalid JSON', () => {
    expect(parseDiaryCmFromWebViewMessage('{not json')).toBeNull()
  })

  it('returns null for unknown type', () => {
    expect(parseDiaryCmFromWebViewMessage(JSON.stringify({ type: 'unknown' }))).toBeNull()
  })

  it('returns null for host→guest message shape', () => {
    const hostMessage: DiaryCmToWebViewMessage = {
      type: 'setContent',
      payload: { content: 'synced' }
    }
    expect(parseDiaryCmFromWebViewMessage(JSON.stringify(hostMessage))).toBeNull()
  })

  it('returns null for non-object payload', () => {
    expect(parseDiaryCmFromWebViewMessage('"ready"')).toBeNull()
  })
})

describe('serializeDiaryCmToWebViewMessage', () => {
  it('serializes init with touch interaction mode', () => {
    const message: DiaryCmToWebViewMessage = {
      type: 'init',
      payload: {
        content: 'diary body',
        placeholder: '写点什么…',
        theme: sampleTheme,
        interactionMode: 'touch'
      }
    }
    expect(JSON.parse(serializeDiaryCmToWebViewMessage(message))).toEqual(message)
  })

  it('serializes command messages used after ready', () => {
    const messages: DiaryCmToWebViewMessage[] = [
      { type: 'setContent', payload: { content: 'next' } },
      { type: 'deleteRange', payload: { from: 0, to: 5 } },
      { type: 'insertAtCursor', payload: { text: '![a](b.png | 200)' } },
      { type: 'setSelection', payload: { start: 3, end: 7 } },
      { type: 'focus' },
      { type: 'blur' },
      { type: 'resolveUrlResponse', payload: { requestId: 'r1', url: null } }
    ]

    for (const message of messages) {
      expect(JSON.parse(serializeDiaryCmToWebViewMessage(message))).toEqual(message)
    }
  })
})

describe('isDiaryCmFromWebViewMessage', () => {
  it('accepts known guest message types by type field only', () => {
    expect(isDiaryCmFromWebViewMessage({ type: 'change', payload: {} })).toBe(true)
    expect(isDiaryCmFromWebViewMessage({ type: 'ready' })).toBe(true)
  })

  it('rejects null and primitives', () => {
    expect(isDiaryCmFromWebViewMessage(null)).toBe(false)
    expect(isDiaryCmFromWebViewMessage('ready')).toBe(false)
  })
})
