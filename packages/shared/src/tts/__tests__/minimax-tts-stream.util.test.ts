import { describe, it, expect } from 'vitest'
import { collectMinimaxTtsStreamAudio } from '../minimax-tts-stream.util'

describe('minimax-tts-stream.util', () => {
  it('collectMinimaxTtsStreamAudio prefers final status=2 audio', async () => {
    const partial = 'fffb'
    const finalAudio = 'fffb9000'
    const sse = [
      `data: ${JSON.stringify({
        data: { audio: partial, status: 1 },
        base_resp: { status_code: 0, status_msg: '' }
      })}`,
      '',
      `data: ${JSON.stringify({
        data: { audio: finalAudio, status: 2 },
        base_resp: { status_code: 0, status_msg: 'success' }
      })}`,
      ''
    ].join('\n')

    const response = new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(sse))
          controller.close()
        }
      })
    )

    const bytes = await collectMinimaxTtsStreamAudio(response)
    expect(Array.from(bytes)).toEqual([0xff, 0xfb, 0x90, 0x00])
  })

  it('collectMinimaxTtsStreamAudio merges partial chunks when final audio is absent', async () => {
    const sse = [
      JSON.stringify({
        data: { audio: 'fffb', status: 1 },
        base_resp: { status_code: 0, status_msg: '' }
      }),
      JSON.stringify({
        data: { audio: '9000', status: 1 },
        base_resp: { status_code: 0, status_msg: '' }
      })
    ].join('\n')

    const response = new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(sse))
          controller.close()
        }
      })
    )

    const bytes = await collectMinimaxTtsStreamAudio(response)
    expect(Array.from(bytes)).toEqual([0xff, 0xfb, 0x90, 0x00])
  })
})
