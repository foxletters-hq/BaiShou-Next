import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const tsx = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'ChatBubble.tsx'),
  'utf8'
)

describe('Native ChatBubble user body chrome', () => {
  it('should render user message body as selectable Text instead of markdown', () => {
    const userBlockStart = tsx.indexOf('!isAssistant &&\n                  (message.content')
    expect(userBlockStart).toBeGreaterThan(0)
    const userBlock = tsx.slice(userBlockStart)
    expect(tsx).toContain('composerExtraPlain')
    expect(userBlock).toContain('NativeSkillCiteChip')
    expect(userBlock).toContain('userCompanionText')
    expect(userBlock).toContain('SkillCitePreviewDialog')
    expect(userBlock).not.toContain('<AgentMarkdownRenderer')
    expect(userBlock).not.toContain('fitContent')
  })
})
