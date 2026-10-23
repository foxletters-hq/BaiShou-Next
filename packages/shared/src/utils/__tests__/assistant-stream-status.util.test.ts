import { describe, expect, it } from 'vitest'
import { readAssistantStreamStatus } from '../assistant-stream-status.util'

describe('readAssistantStreamStatus', () => {
  it('should return in_progress when a part carries the checkpoint flag', () => {
    expect(
      readAssistantStreamStatus([
        { type: 'text', data: { text: '一半' } },
        { type: 'text', data: { text: '', streamStatus: 'in_progress' } }
      ])
    ).toBe('in_progress')
  })

  it('should return undefined when the reply is finished', () => {
    expect(readAssistantStreamStatus([{ type: 'text', data: { text: '写完了' } }])).toBeUndefined()
  })
})
