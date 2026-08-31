import { execFileSync } from 'node:child_process'
import {
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(here, '../../../../../')
const lucideVersion = '1.7.0'
const workDir = join(tmpdir(), `baishou-lucide-meta-${lucideVersion}`)
const scanRoots = [
  join(repoRoot, 'apps/desktop/src'),
  join(repoRoot, 'packages/ui/src')
]
const skipName = new Set([
  'icon-gallery-catalog.ts',
  'DeveloperIconGallery.tsx',
  'generate-lucide-icon-gallery-data.mjs',
  'used-lucide-icons.ts',
  'lucide-icon-meta.json'
])

const CATEGORY_ORDER = [
  'accessibility',
  'account',
  'animals',
  'arrows',
  'buildings',
  'charts',
  'communication',
  'connectivity',
  'cursors',
  'design',
  'development',
  'devices',
  'emoji',
  'files',
  'finance',
  'food-beverage',
  'gaming',
  'home',
  'layout',
  'mail',
  'math',
  'medical',
  'multimedia',
  'nature',
  'navigation',
  'notifications',
  'people',
  'photography',
  'science',
  'seasons',
  'security',
  'shapes',
  'shopping',
  'social',
  'sports',
  'sustainability',
  'text',
  'time',
  'tools',
  'transportation',
  'travel',
  'weather'
]

function kebabToPascal(kebab) {
  return kebab.replace(/(^|-)([a-z0-9])/g, (_, __, ch) => ch.toUpperCase())
}

function walkFiles(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === '__tests__') continue
      walkFiles(full, out)
      continue
    }
    if (skipName.has(entry.name)) continue
    if (entry.name.includes('.test.')) continue
    if (extname(entry.name) === '.ts' || extname(entry.name) === '.tsx') out.push(full)
  }
  return out
}

function collectUsedIconNames() {
  const used = new Set()
  const importRe =
    /import\s+(?:type\s+)?(?:[\w*]+\s*,\s*)?\{([^}]+)\}\s+from\s+['"]lucide-react['"]/g
  for (const root of scanRoots) {
    for (const file of walkFiles(root)) {
      const src = readFileSync(file, 'utf8')
      for (const match of src.matchAll(importRe)) {
        for (const part of match[1].split(',')) {
          const token = part.trim()
          if (!token || token.startsWith('type ') || token === 'type') continue
          const name = token.split(/\s+as\s+/)[0].trim()
          if (/^[A-Z][A-Za-z0-9]*$/.test(name)) used.add(name)
        }
      }
    }
  }
  return [...used].sort((a, b) => a.localeCompare(b))
}

function extractTarball(archive, dest) {
  mkdirSync(dest, { recursive: true })
  execFileSync('tar', ['-xzf', archive, '-C', dest], { stdio: 'inherit' })
}

async function downloadLucideIcons() {
  mkdirSync(workDir, { recursive: true })
  const archive = join(workDir, `lucide-${lucideVersion}.tar.gz`)
  const url = `https://codeload.github.com/lucide-icons/lucide/tar.gz/refs/tags/${lucideVersion}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`download lucide ${lucideVersion} failed: ${res.status}`)
  writeFileSync(archive, Buffer.from(await res.arrayBuffer()))
  const unpacked = join(workDir, 'unpacked')
  rmSync(unpacked, { recursive: true, force: true })
  extractTarball(archive, unpacked)
  const root = readdirSync(unpacked).find((name) => name.startsWith('lucide-'))
  if (!root) throw new Error('lucide tarball layout unexpected')
  return join(unpacked, root, 'icons')
}

function readIconMeta(iconsDir) {
  const meta = {}
  for (const file of readdirSync(iconsDir)) {
    if (!file.endsWith('.json')) continue
    const kebab = file.slice(0, -'.json'.length)
    const json = JSON.parse(readFileSync(join(iconsDir, file), 'utf8'))
    const categories = Array.isArray(json.categories)
      ? json.categories.filter((item) => typeof item === 'string')
      : []
    const tags = Array.isArray(json.tags) ? json.tags.filter((item) => typeof item === 'string') : []
    meta[kebabToPascal(kebab)] = { categories, tags }
  }
  return meta
}

const lucide = await import('lucide-react')
const lucideNames = new Set(
  Object.keys(lucide).filter((name) => /^[A-Z]/.test(name) && typeof lucide[name] === 'object')
)
const used = collectUsedIconNames().filter((name) => lucideNames.has(name))
const iconsDir = await downloadLucideIcons()
const meta = readIconMeta(iconsDir)

writeFileSync(
  join(here, 'lucide-icon-meta.json'),
  `${JSON.stringify({ categoryOrder: CATEGORY_ORDER, icons: meta }, null, 2)}\n`
)
writeFileSync(
  join(here, 'used-lucide-icons.ts'),
  `export const USED_LUCIDE_ICON_NAMES = ${JSON.stringify(used, null, 2)} as const\n`
)
console.log(`used ${used.length}, lucide ${lucideNames.size}, meta ${Object.keys(meta).length}`)
