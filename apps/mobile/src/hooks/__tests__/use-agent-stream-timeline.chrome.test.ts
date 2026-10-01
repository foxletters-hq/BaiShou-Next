import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const streamSrc = readFileSync(join(here, '../useAgentStream.ts'), 'utf8')
const bridgeSrc = readFileSync(join(here, '../useAgentStream-bridge.ts'), 'utf8')
const chatSrc = readFileSync(join(here, '../useAgentStream-chat.ts'), 'utf8')

describe('Mobile agent stream timeline chrome', () => {
  it('should accumulate live think/tool/text in occurrence order instead of two string buffers', () => {
    expect(bridgeSrc).toContain('appendTimelineReasoning')
    expect(bridgeSrc).toContain('appendTimelineText')
    expect(bridgeSrc).toContain('appendTimelineToolStart')
    expect(bridgeSrc).toContain('completeTimelineTool')
    expect(streamSrc).toContain('timeline')
    expect(streamSrc).toContain('setTimeline')
  })

  it('should pass toolCallId into timeline start and complete so a later think opens a new segment', () => {
    expect(chatSrc).toContain('onToolCallStart:')
    expect(chatSrc).toContain('onToolCallResult:')
    expect(bridgeSrc).toContain('toolCallId')
    expect(bridgeSrc).toContain('appendTimelineToolStart')
    expect(bridgeSrc).toContain('completeTimelineTool')
  })

  it('should clear the live timeline when stream buffers reset', () => {
    expect(bridgeSrc).toContain('timelineRef.current = []')
    expect(bridgeSrc).toContain('setTimeline')
  })
})
