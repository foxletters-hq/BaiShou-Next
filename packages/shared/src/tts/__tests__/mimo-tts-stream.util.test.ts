import { describe, it, expect } from 'vitest'
import { collectMimoTtsStreamPcm16, pcm16ToWavBase64 } from '../mimo-tts-stream.util'

describe('mimo-tts-stream.util', () => {
  it('pcm16ToWavBase64 wraps pcm with wav header', () => {
    const pcm = new Uint8Array([0, 1, 2, 3])
    const wavBase64 = pcm16ToWavBase64(pcm)
    const binary = atob(wavBase64)
    expect(binary.startsWith('RIFF')).toBe(true)
    expect(binary.includes('WAVE')).toBe(true)
  })

  it('collectMimoTtsStreamPcm16 merges delta audio chunks', async () => {
    const chunkA = btoa(String.fromCharCode(0, 1))
    const chunkB = btoa(String.fromCharCode(2, 3))
    const sse = [
      `data: ${JSON.stringify({ choices: [{ delta: { audio: { data: chunkA } } }] })}`,
      '',
      `data: ${JSON.stringify({ choices: [{ delta: { audio: { data: chunkB } } }] })}`,
      '',
      'data: [DONE]',
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

    const pcm = await collectMimoTtsStreamPcm16(response)
    expect(Array.from(pcm)).toEqual([0, 1, 2, 3])
  })
})
