import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const dialogSrc = readFileSync(join(here, '..', 'ContextChainDialog.tsx'), 'utf8')
const flatListSrc = readFileSync(join(here, '..', 'ContextChainFlatList.tsx'), 'utf8')
const footerSrc = readFileSync(join(here, '..', 'ContextChainFooter.tsx'), 'utf8')
const detailSrc = readFileSync(join(here, '..', 'ContextChainDetailPage.tsx'), 'utf8')
const stylesSrc = readFileSync(join(here, '..', 'context-chain-flat-list.styles.ts'), 'utf8')

describe('ContextChainDialog typography and spacing chrome', () => {
  it('uses mobileTypography tokens and avoids hardcoded font sizes in flat list styles', () => {
    expect(stylesSrc).toContain('mobileTypography.caption.fontSize')
    expect(stylesSrc).toContain('mobileTypography.secondary.fontSize')
    expect(stylesSrc).not.toMatch(/fontSize:\s*\d+/)
  })

  it('uses lucide icons instead of raw glyphs for navigation and toggles', () => {
    expect(flatListSrc).toContain('ChevronRight')
    expect(flatListSrc).not.toContain("'>'")
    expect(flatListSrc).not.toContain("'›'")
    expect(flatListSrc).not.toContain("'▶'")

    expect(dialogSrc).toContain('<X')
    expect(dialogSrc).not.toContain("'>'")
    expect(dialogSrc).not.toContain("'>'")
    expect(dialogSrc).not.toContain("'×'")

    expect(detailSrc).toContain('ChevronLeft')
    expect(detailSrc).toContain('<X')
    expect(detailSrc).not.toContain("'‹'")
    expect(detailSrc).not.toContain("'×'")
  })

  it('renders footer stat chips with theme styling', () => {
    expect(footerSrc).toContain('statChip')
    expect(footerSrc).toContain('statRow')
    expect(footerSrc).toContain('StyleSheet.hairlineWidth')
  })
})
