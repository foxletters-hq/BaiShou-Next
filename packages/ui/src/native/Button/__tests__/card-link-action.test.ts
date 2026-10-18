import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))

describe('CardLinkAction chrome and styles', () => {
  it('card variant style should stretch full width and center content', () => {
    const stylesSrc = readFileSync(join(here, '../card-link-action.styles.ts'), 'utf8')
    expect(stylesSrc).toContain("alignSelf: 'stretch'")
    expect(stylesSrc).toContain("justifyContent: 'center'")
  })

  it('CardLinkAction should default to card variant and apply variant style', () => {
    const compSrc = readFileSync(join(here, '../CardLinkAction.tsx'), 'utf8')
    expect(compSrc).toContain("variant = 'card'")
    expect(compSrc).toContain('cardLinkActionStyles[variant]')
  })
})
