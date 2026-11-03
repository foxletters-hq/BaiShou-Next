import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const tsx = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'ChatBubble.tsx'),
  'utf8'
)

describe('Native ChatBubble user display name', () => {
  it('should not fallback user nickname to "你" or you_label', () => {
    expect(tsx).not.toContain("t('agent.chat.you_label', '你')")
    expect(tsx).not.toContain("userProfile?.nickname || '你'")
    expect(tsx).toContain("userProfile?.nickname?.trim() || ''")
  })

  it('only renders user name label when displayName is non-empty', () => {
    expect(tsx).toContain(
      '{displayName ? <Text style={nameLabelStyle}>{displayName}</Text> : null}'
    )
  })
})
