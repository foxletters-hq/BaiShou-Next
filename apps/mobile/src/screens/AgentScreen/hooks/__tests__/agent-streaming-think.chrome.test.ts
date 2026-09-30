import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const presentationSrc = readFileSync(join(here, '..', 'useAgentStreamingPresentation.tsx'), 'utf8')
const listSrc = readFileSync(join(here, '..', '..', 'components', 'AgentChatList.tsx'), 'utf8')

describe('Mobile live think streaming chrome', () => {
  it('should mark think markdown as streaming while live reasoning is present', () => {
    expect(presentationSrc).toContain(
      'isThinkStreaming: markdownPresentationActive && Boolean(streamingReasoning.trim())'
    )
    expect(presentationSrc).not.toContain('isThinkStreaming: false')
    expect(listSrc).toContain('isThinkStreaming:')
    expect(listSrc).not.toContain('isThinkStreaming: false')
  })
})
