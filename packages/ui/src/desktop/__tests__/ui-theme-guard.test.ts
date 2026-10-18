import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../../../../../')

const CSS_ROOTS = [join(repoRoot, 'packages/ui/src'), join(repoRoot, 'apps/desktop/src/renderer')]

const THEME_SSOT = new Set(['packages/ui/src/theme/css-variables.css'])

function walk(dir, predicate, out = []) {
  if (!statSync(dir, { throwIfNoEntry: false })?.isDirectory()) return out
  for (const name of readdirSync(dir)) {
    if (['node_modules', 'dist', 'out', '__tests__', '.git'].includes(name)) continue
    const full = join(dir, name)
    const stat = statSync(full)
    if (stat.isDirectory()) walk(full, predicate, out)
    else if (predicate(name)) out.push(full)
  }
  return out
}

function rel(file) {
  return file.slice(repoRoot.length).replace(/\\/g, '/').replace(/^\//, '')
}

const DATA_THEME_RE = /\[data-theme=['"]dark['"]\]/
const HARD_BASE_COLOR_RE =
  /(?:^|[;{\s])(?:color|background(?:-color)?|border(?:-color)?)\s*:\s*(?:#fff(?:fff)?\b|#000(?:000)?\b|\bwhite\b|\bblack\b)/i
const HEX_FALLBACK_RE = /var\(--[^,)]+,\s*#[0-9a-fA-F]{3,8}\)/
const HARD_OVERLAY_TOP_RE = /top:\s*52px|top:\s*48px/

describe('UI theme guard', () => {
  const cssFiles = CSS_ROOTS.flatMap((root) => walk(root, (name) => name.endsWith('.css')))

  it('keeps [data-theme=dark] only in theme SSOT', () => {
    const unexpected = []
    for (const file of cssFiles) {
      const path = rel(file)
      if (THEME_SSOT.has(path)) continue
      if (DATA_THEME_RE.test(readFileSync(file, 'utf8'))) unexpected.push(path)
    }
    expect(unexpected).toEqual([])
  })

  it('does not hard-code overlay clip as 48px / 52px outside the chrome helper', () => {
    const allowed = new Set([
      'packages/ui/src/theme/app-chrome.css',
      'packages/ui/src/theme/css-variables.css',
      'packages/ui/src/desktop/Modal/Modal.module.css'
    ])
    const unexpected = []
    for (const file of cssFiles) {
      const path = rel(file)
      if (allowed.has(path)) continue
      const src = readFileSync(file, 'utf8')
      if (HARD_OVERLAY_TOP_RE.test(src) && /position:\s*fixed/.test(src)) unexpected.push(path)
    }
    expect(unexpected).toEqual([])
  })

  it('does not use white/black/#fff/#000 as surface or text color', () => {
    const unexpected = []
    for (const file of cssFiles) {
      const path = rel(file)
      if (THEME_SSOT.has(path)) continue
      const src = readFileSync(file, 'utf8')
      if (HARD_BASE_COLOR_RE.test(src)) unexpected.push(path)
    }
    expect(unexpected).toEqual([])
  })

  it('does not put hex fallbacks inside var()', () => {
    const unexpected = []
    for (const file of cssFiles) {
      const path = rel(file)
      if (THEME_SSOT.has(path)) continue
      if (HEX_FALLBACK_RE.test(readFileSync(file, 'utf8'))) unexpected.push(path)
    }
    expect(unexpected).toEqual([])
  })

  it('does not hard-code font-size pixels outside the theme SSOT', () => {
    const fontPx = /font-size:\s*(?!0(?:px)?\b)\d+(?:\.\d+)?px/
    const unexpected = []
    for (const file of cssFiles) {
      const path = rel(file)
      if (THEME_SSOT.has(path)) continue
      if (fontPx.test(readFileSync(file, 'utf8'))) unexpected.push(path)
    }
    expect(unexpected).toEqual([])
  })

  it('does not hard-code common spacing, radius, or duration pixels outside the theme SSOT', () => {
    const spaceProps =
      /(?:padding(?:-(?:top|right|bottom|left|inline|block))?|margin(?:-(?:top|right|bottom|left|inline|block))?|gap|row-gap|column-gap|border(?:-top|-bottom|-left|-right)?-radius)\s*:\s*([^;{}]+);/gi
    const durationProps = /(?:transition(?:-duration)?|animation(?:-duration)?)\s*:\s*([^;{}]+);/gi
    const commonPx = /(?<!-)\b(?:2|3|4|5|6|7|8|9|10|11|12|13|14|16|18|20|22|24|36|40|64)px\b/
    const commonRadius = /(?<!-)\b(?:2|3|4|5|6|7|8|9|10|12|14|16|20|22|24|999|9999)px\b/
    const commonTime =
      /\b(?:80|100|120|140|150|160|180|200|220|250|280|300|340|350|400)ms\b|\b0\.(?:1|12|14|15|16|18|2|22|25|28|3|34|35|4)s\b/
    const stripVar = (value) => value.replace(/var\([^)]*\)/g, '')
    const unexpected = []
    for (const file of cssFiles) {
      const path = rel(file)
      if (THEME_SSOT.has(path)) continue
      const src = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
      for (const match of src.matchAll(spaceProps)) {
        const decl = match[0]
        const value = stripVar(match[1])
        const isRadius = /radius/i.test(decl)
        if ((isRadius ? commonRadius : commonPx).test(value)) {
          unexpected.push(`${path} ${decl.trim()}`)
        }
      }
      for (const match of src.matchAll(durationProps)) {
        if (commonTime.test(stripVar(match[1]))) unexpected.push(`${path} ${match[0].trim()}`)
      }
    }
    expect(unexpected).toEqual([])
  })

  it('keeps expanded spacing, radius, and duration tokens in the theme SSOT', () => {
    const tokens = readFileSync(join(repoRoot, 'packages/ui/src/theme/css-variables.css'), 'utf8')
    expect(tokens).toContain('--spacing-md-tight:')
    expect(tokens).toContain('--spacing-sm-plus:')
    expect(tokens).toContain('--radius-control:')
    expect(tokens).toContain('--duration-swift:')
    expect(tokens).toContain('--duration-moderate:')
  })

  it('uses theme tokens for text selection instead of the system highlight', () => {
    const tokens = readFileSync(join(repoRoot, 'packages/ui/src/theme/css-variables.css'), 'utf8')
    const fields = readFileSync(join(repoRoot, 'packages/ui/src/theme/form-field.css'), 'utf8')
    expect(tokens).toContain('--text-selection-bg:')
    expect(tokens).toContain('--text-selection-fg:')
    expect(fields).toContain('::selection')
    expect(fields).toContain('var(--text-selection-bg)')
    expect(fields).toContain('var(--text-selection-fg)')
    expect(fields).toMatch(/:where\(\s*input,\s*textarea\s*\)::selection/)
    expect(fields).toMatch(
      /\.baishou-form-field\.baishou-form-field--embed[\s\S]*border-radius:\s*0/
    )
  })
})
