import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const styles = readFileSync(join(here, '../chat-bubble.styles.ts'), 'utf8')
const streamSrc = readFileSync(join(here, '../../StreamingBubble/StreamingBubble.tsx'), 'utf8')

describe('Native ChatBubble column align chrome', () => {
  it('should reserve the same opposite gap on assistant bubbles as user bubbles', () => {
    expect(styles).toContain('CHAT_BUBBLE_OPPOSITE_GAP')
    expect(styles).toMatch(/bubbleWrapperUser:[\s\S]*marginLeft:\s*CHAT_BUBBLE_OPPOSITE_GAP/)
    expect(styles).toMatch(/bubbleWrapperAssistant:[\s\S]*marginRight:\s*CHAT_BUBBLE_OPPOSITE_GAP/)
    expect(styles).not.toMatch(/bubbleWrapperAssistant:[\s\S]*marginRight:\s*0/)
  })

  it('should keep the streaming bubble on the same assistant wrapper width', () => {
    expect(streamSrc).toContain('chatBubbleStyles.bubbleWrapperAssistant')
    expect(streamSrc).toContain('chatBubbleStyles.bubbleWrapperEditing')
  })
})
