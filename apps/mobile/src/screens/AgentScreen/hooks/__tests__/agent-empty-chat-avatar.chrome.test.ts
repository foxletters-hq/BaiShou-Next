import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const presentationSrc = readFileSync(join(here, '..', 'useAgentStreamingPresentation.tsx'), 'utf8')
const stylesSrc = readFileSync(join(here, '..', '..', 'agent-screen.styles.ts'), 'utf8')
const constantsSrc = readFileSync(join(here, '..', '..', 'agent-screen.constants.ts'), 'utf8')

describe('Mobile empty chat partner avatar chrome', () => {
  it('should render the current partner avatar instead of a sparkles icon when there is no conversation', () => {
    expect(presentationSrc).toContain('<AssistantAvatar')
    expect(presentationSrc).toContain('chatAiProfile.avatarPath')
    expect(presentationSrc).toContain('chatAiProfile.resolvedAvatarUri')
    expect(presentationSrc).toContain('EMPTY_CHAT_AVATAR_SIZE')
    expect(presentationSrc).not.toContain('Sparkles')
    expect(constantsSrc).toMatch(/export const EMPTY_CHAT_AVATAR_SIZE = 88/)
    expect(stylesSrc).toContain('emptyAvatar')
    expect(stylesSrc).not.toContain('emptyIconCircle')
  })

  it('should break the idle greeting on sentence punctuation instead of a max-width wrap', () => {
    expect(presentationSrc).toContain('splitAgentIdleGreetingLines')
    expect(presentationSrc).toContain('greetingLines.map')
    expect(presentationSrc).not.toContain(".join('\\n')")
    expect(stylesSrc).not.toMatch(/emptyText:[\s\S]*maxWidth/)
    expect(stylesSrc).not.toMatch(/emptySub:[\s\S]*maxWidth/)
  })

  it('should tighten avatar-to-text spacing and add an explicit gap between greeting lines', () => {
    expect(stylesSrc).toMatch(
      /emptyAvatar:\s*\{[\s\S]*?marginBottom:\s*sharedTokens\.spacing\.mdTight/
    )
    expect(stylesSrc).toMatch(/emptyGreeting:\s*\{[\s\S]*?gap:\s*sharedTokens\.spacing\.sm\b/)
  })
})
