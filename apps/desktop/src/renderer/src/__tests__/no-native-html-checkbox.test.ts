import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const rendererRoot = join(dirname(fileURLToPath(import.meta.url)), '..')

const SWITCH_MARKERS = [
  'settings-switch-slider',
  'toggleSwitch',
  'update-toggle-switch',
  'version-toggle-switch'
]

function listTsx(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    const stat = statSync(full)
    if (stat.isDirectory()) {
      if (name === '__tests__' || name === 'node_modules' || name === 'dist') continue
      out.push(...listTsx(full))
      continue
    }
    if (name.endsWith('.tsx')) out.push(full)
  }
  return out
}

function isAllowedCheckboxFile(file: string, src: string): boolean {
  const normalized = file.replaceAll('\\', '/')
  if (normalized.endsWith('/Checkbox/Checkbox.tsx') || normalized.endsWith('/Switch/Switch.tsx')) {
    return true
  }
  return SWITCH_MARKERS.some((marker) => src.includes(marker))
}

describe('desktop renderer checkboxes', () => {
  it('does not use a native html checkbox outside Checkbox and switches', () => {
    const hits = listTsx(rendererRoot).filter((file) => {
      const src = readFileSync(file, 'utf8')
      if (!src.includes('type="checkbox"') && !src.includes("type='checkbox'")) return false
      return !isAllowedCheckboxFile(file, src)
    })
    expect(hits).toEqual([])
  })
})
