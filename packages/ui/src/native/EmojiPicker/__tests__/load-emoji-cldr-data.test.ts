import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { filterEmojiCldrRecords } from '../load-emoji-cldr-data'

const here = dirname(fileURLToPath(import.meta.url))

describe('filterEmojiCldrRecords', () => {
  it('should drop empty glyphs and the skin-tone component group', () => {
    const records = filterEmojiCldrRecords([
      { emoji: '😀', annotation: 'grin', tags: [], group: 0, order: 1 },
      { emoji: '', annotation: 'blank', tags: [], group: 0, order: 2 },
      { emoji: '🏻', annotation: 'skin', tags: [], group: 2, order: 3 },
      { emoji: '🐱', annotation: 'cat', tags: [], group: 3, order: 4 }
    ])
    expect(records.map((item) => item.emoji)).toEqual(['😀', '🐱'])
  })
})

describe('emoji cldr loader chrome', () => {
  it('should load CLDR json only through a dynamic import', () => {
    const loader = readFileSync(join(here, '../load-emoji-cldr-data.ts'), 'utf8')
    expect(loader).toContain("import('emoji-picker-element-data/en/cldr/data.json')")
    expect(loader).not.toMatch(/import\s+\w+\s+from\s+['"]emoji-picker-element-data/)

    const picker = readFileSync(join(here, '../EmojiPicker.tsx'), 'utf8')
    expect(picker).not.toMatch(/import\s+\w+\s+from\s+['"]emoji-picker-element-data/)
    expect(picker).toContain('loadEmojiCldrData')
  })
})
