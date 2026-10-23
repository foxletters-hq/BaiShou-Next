import { afterEach, describe, expect, it, vi } from 'vitest'
import { createOpenCodeGoFetch } from '../opencodego.language-model.factory'

describe('createOpenCodeGoFetch', () => {
  const originalGlobalFetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = originalGlobalFetch
    delete (globalThis as { __expoFetch?: typeof fetch }).__expoFetch
  })

  it('prefers the platform expo/fetch over global fetch for response.body streaming', async () => {
    const globalFetch = vi.fn()
    const expoFetch = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }))
    globalThis.fetch = globalFetch as unknown as typeof fetch
    ;(globalThis as { __expoFetch?: typeof fetch }).__expoFetch =
      expoFetch as unknown as typeof fetch

    const openCodeFetch = createOpenCodeGoFetch('session-1')
    await openCodeFetch('https://opencode.ai/zen/go/v1/chat/completions', { method: 'POST' })

    expect(expoFetch).toHaveBeenCalledTimes(1)
    expect(globalFetch).not.toHaveBeenCalled()
  })
})
