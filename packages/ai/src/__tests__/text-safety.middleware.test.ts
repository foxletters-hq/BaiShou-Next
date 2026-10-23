import { describe, expect, it } from 'vitest'
import { createTextSafetyMiddleware } from '../middleware/text-safety.middleware'

type Transform = (input: { params: Record<string, unknown> }) => Promise<Record<string, unknown>>

function transform(middleware: unknown, params: Record<string, unknown>) {
  return (middleware as { transformParams: Transform }).transformParams({ params })
}

describe('createTextSafetyMiddleware', () => {
  it('replaces lone surrogates inside prompt parts', async () => {
    const middleware = createTextSafetyMiddleware()
    const params = {
      prompt: [
        { role: 'user', content: '前文 \ud83d 后文' },
        {
          role: 'tool',
          content: [{ type: 'tool-result', toolName: 't', toolCallId: 'c', output: 'bad \ude00' }]
        }
      ]
    }

    const result = await transform(middleware, params)

    expect(result.prompt).toEqual([
      { role: 'user', content: '前文 \uFFFD 后文' },
      {
        role: 'tool',
        content: [{ type: 'tool-result', toolName: 't', toolCallId: 'c', output: 'bad \uFFFD' }]
      }
    ])
  })

  it('keeps valid emoji intact', async () => {
    const middleware = createTextSafetyMiddleware()
    const params = { prompt: [{ role: 'user', content: '你好 😀' }] }

    const result = await transform(middleware, params)

    expect(result).toBe(params)
  })

  it('sanitizes system and tools strings too', async () => {
    const middleware = createTextSafetyMiddleware()
    const params = {
      prompt: [],
      system: 'system \ud83d',
      tools: [{ type: 'function', name: 't', description: 'desc \ude00', inputSchema: {} }]
    }

    const result = await transform(middleware, params)

    expect(result.system).toBe('system \uFFFD')
    expect(result.tools).toEqual([
      { type: 'function', name: 't', description: 'desc \uFFFD', inputSchema: {} }
    ])
  })
})
