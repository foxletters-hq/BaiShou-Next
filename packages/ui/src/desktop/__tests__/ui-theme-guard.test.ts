import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../../../../../')

const CSS_ROOTS = [join(repoRoot, 'packages/ui/src'), join(repoRoot, 'apps/desktop/src/renderer')]

const THEME_SSOT = new Set([
  'packages/ui/src/theme/css-variables.css',
  'apps/desktop/src/renderer/src/styles/variables.css'
])

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
})
