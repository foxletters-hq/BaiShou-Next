import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))

describe('EmojiToolCard icon chrome', () => {
  it('should not import vector icon fonts', () => {
    const src = readFileSync(join(here, '../EmojiToolCard.tsx'), 'utf8')
    expect(src).not.toContain('@expo/vector-icons')
    expect(src).not.toContain('MaterialIcons')
    expect(src).toContain("from 'lucide-react-native'")
  })

  it('should inset the emoji settings grid scroll indicator like SkillCitePreviewDialog', () => {
    const src = readFileSync(join(here, '../EmojiToolCard.tsx'), 'utf8')
    expect(src).toContain('paddingRight: sharedTokens.spacing.mdTight')
  })
})
