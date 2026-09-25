import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { deriveLegacyVaultId, AgentGateReply } from '@baishou/shared'
import { streamText } from 'ai'
import { afterEach, describe, expect, it } from 'vitest'
import { createBaishouAgentGate } from '../../baishou-agent-gate/baishou-agent-gate.service'
import { CompanionAskTool } from '../companion-ask.tool'
import { clearCompanionAskStreamSessionsForTests } from '../companion-ask-stream.util'

function sseChunk(delta: Record<string, unknown>, finish: string | null = null): string {
  return `data: ${JSON.stringify({
    id: 'c',
    object: 'chat.completion.chunk',
    choices: [{ index: 0, delta, finish_reason: finish }]
  })}\n\n`
}

describe('CompanionAskTool streamed gate', () => {
  afterEach(() => {
    clearCompanionAskStreamSessionsForTests()
  })

  it('should open the question card before the provider stream closes', async () => {
    let release = () => {}
    const held = new Promise<void>((resolve) => {
      release = resolve
    })
    const encoder = new TextEncoder()
    const body = new ReadableStream<Uint8Array>({
      async start(controller) {
        const head =
          sseChunk({ reasoning_content: 'I will ask which city.' }) +
          sseChunk({
            tool_calls: [
              {
                index: 0,
                id: 'call_1',
                type: 'function',
                function: { name: 'companion_ask', arguments: '' }
              }
            ]
          }) +
          sseChunk({
            tool_calls: [
              {
                index: 0,
                function: {
                  arguments: '{"question":"你在哪个城市？","options":["北京","上海"]}'
                }
              }
            ]
          })
        controller.enqueue(encoder.encode(head))
        await held
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      }
    })

    const { gate } = createBaishouAgentGate({
      config: { exclusionList: [], allowlist: [] }
    })
    const vercelTool = new CompanionAskTool().toVercelTool({
      sessionId: 'sess_1',
      vaultId: deriveLegacyVaultId('Personal'),
      vaultName: 'Personal',
      agentGate: gate
    })
    const provider = createOpenAICompatible({
      name: 'deepseek',
      apiKey: 'test',
      baseURL: 'https://api.deepseek.com/v1',
      fetch: async () =>
        new Response(body, {
          status: 200,
          headers: { 'content-type': 'text/event-stream' }
        })
    })

    const result = streamText({
      model: provider.chatModel('deepseek-flash'),
      prompt: '查天气',
      tools: { companion_ask: vercelTool }
    })

    const consume = (async () => {
      for await (const _part of result.fullStream) {
        // 只为把流往下拉；确认门应在 [DONE] 之前出现
      }
    })()

    try {
      const started = Date.now()
      let requestId = ''
      while (Date.now() - started < 2000) {
        const pending = gate.listPending('sess_1')
        if (pending[0]) {
          requestId = pending[0].id
          break
        }
        await new Promise((resolve) => setTimeout(resolve, 15))
      }

      expect(requestId).not.toBe('')
      expect(gate.listPending('sess_1')[0]?.title).toBe('你在哪个城市？')

      await gate.reply({
        requestId,
        reply: AgentGateReply.Once,
        selectedOptionIds: ['0']
      })
    } finally {
      release()
      await new Promise((resolve) => setTimeout(resolve, 30))
      gate.cancelSession('sess_1', 'test-done')
      await Promise.race([
        consume,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('provider stream did not finish')), 3000)
        )
      ])
    }
  })
})
