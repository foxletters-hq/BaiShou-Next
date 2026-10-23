import { createRequire } from 'node:module'
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { transformSync } from '@babel/core'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const plugin = require('../../babel/lucide-native-deep-import.cjs')

const FIXTURE_BARREL = `
export { default as Search, default as SearchIcon } from './icons/search.js';
export { default as CheckCircle2, default as CircleCheck } from './icons/circle-check.js';
export { default as Image, default as ImageIcon } from './icons/image.js';
`

function fixtureBarrelFile(): string {
  const dir = mkdtempSync(join(tmpdir(), 'lucide-barrel-'))
  const file = join(dir, 'lucide-react-native.js')
  writeFileSync(file, FIXTURE_BARREL, 'utf8')
  return file
}

function transform(code: string, barrelFile = fixtureBarrelFile()): string {
  const result = transformSync(code, {
    babelrc: false,
    configFile: false,
    filename: 'lucide-import.tsx',
    parserOpts: {
      sourceType: 'module',
      plugins: ['typescript', 'jsx']
    },
    plugins: [[plugin, { barrelFile }]]
  })
  if (!result?.code) {
    throw new Error('expected babel output')
  }
  return result.code
}

describe('lucide native deep import plugin', () => {
  it('should rewrite named value imports to per-icon modules when barrel aliases differ', () => {
    const code = transform(`import { Search, CheckCircle2 } from 'lucide-react-native'`)
    expect(code).toContain('from "lucide-react-native/dist/esm/icons/search.js"')
    expect(code).toContain('from "lucide-react-native/dist/esm/icons/circle-check.js"')
    expect(code).not.toContain('from "lucide-react-native"')
  })

  it('should keep local aliases and type-only specifiers', () => {
    const code = transform(
      `import { type LucideProps, Image as ImageIcon } from 'lucide-react-native'`
    )
    expect(code).toContain('from "lucide-react-native/dist/esm/icons/image.js"')
    expect(code).toMatch(/import\s+type\s+\{\s*LucideProps\s*\}\s+from\s+"lucide-react-native"/)
    expect(code).toMatch(/import\s+ImageIcon\s+from/)
  })

  it('should leave a fully type-only import unchanged', () => {
    const input = `import type { LucideProps } from 'lucide-react-native';`
    expect(transform(input)).toContain('lucide-react-native')
    expect(transform(input)).not.toContain('/dist/esm/icons/')
  })

  it('should map real lucide aliases onto existing icon files', () => {
    const barrelFile = join(
      process.cwd(),
      '../../node_modules/lucide-react-native/dist/esm/lucide-react-native.js'
    )
    const fallback = join(
      process.cwd(),
      'node_modules/lucide-react-native/dist/esm/lucide-react-native.js'
    )
    const resolved = existsSync(barrelFile) ? barrelFile : fallback
    expect(existsSync(resolved)).toBe(true)

    const code = transform(
      `import { CheckCircle2, HelpCircle, MoreVertical, BarChart3 } from 'lucide-react-native'`,
      resolved
    )
    expect(code).toContain('/icons/circle-check.js')
    expect(code).toContain('/icons/circle-help.js')
    expect(code).toContain('/icons/ellipsis-vertical.js')
    expect(code).toContain('/icons/chart-column.js')

    for (const fileName of [
      'circle-check.js',
      'circle-help.js',
      'ellipsis-vertical.js',
      'chart-column.js'
    ]) {
      expect(existsSync(join(resolved, '../icons', fileName))).toBe(true)
    }
  })
})
