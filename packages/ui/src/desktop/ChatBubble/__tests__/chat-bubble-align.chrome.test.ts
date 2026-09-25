import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const css = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'ChatBubble.module.css'),
  'utf8'
)
const streamCss = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../../StreamingBubble/StreamingBubble.module.css'),
  'utf8'
)

describe('ChatBubble column align chrome', () => {
  it('should share one message column so user and AI bubbles end on the same edge', () => {
    expect(css).toContain('grid-template-columns: 36px minmax(0, 1fr) 36px')
    const messageColRule = css.slice(css.indexOf('.messageCol {'), css.indexOf('.userRow .messageCol'))
    expect(messageColRule).toContain('grid-column: 2')
    expect(messageColRule).toContain('width: 100%')
    expect(css).toMatch(/\.userRow\s+\.avatarWrap[\s\S]*grid-column:\s*3/)
    expect(css).toMatch(/\.aiRow\s+\.avatarWrap[\s\S]*grid-column:\s*1/)
    expect(css).toMatch(/\.aiBubbleCard[\s\S]*width:\s*100%/)
    expect(css).toMatch(/\.userBubbleCard[\s\S]*align-self:\s*flex-end/)
    const userMessageColRule = css.slice(
      css.indexOf('.userRow .messageCol'),
      css.indexOf('.aiRow .messageCol')
    )
    expect(userMessageColRule).not.toContain('width: fit-content')
  })

  it('should keep a stream error under the last assistant bubble', () => {
    const tsx = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '..', 'ChatBubbleAiRow.tsx'),
      'utf8'
    )
    expect(css).toContain('.errorBox')
    expect(tsx).toContain('error')
    expect(tsx).toContain('styles.errorBox')
  })

  it('should reserve the same right avatar column on the streaming bubble', () => {
    expect(streamCss).toContain('grid-template-columns: 36px minmax(0, 1fr) 36px')
    expect(streamCss).toMatch(/\.messageCol[\s\S]*width:\s*100%/)
    expect(streamCss).toMatch(/\.bubbleCard[\s\S]*width:\s*100%/)
  })
})
