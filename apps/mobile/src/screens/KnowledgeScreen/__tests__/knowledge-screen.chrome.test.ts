import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const src = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'KnowledgeScreen.tsx'),
  'utf8'
)

describe('mobile knowledge list chrome', () => {
  it('should create, rename, reorder, and show cover images', () => {
    expect(src).toContain('mobileCreateNotebook')
    expect(src).toContain('mobileReorderNotebooks')
    expect(src).toContain('mobileResolveNotebookCoverUri')
    expect(src).toContain('knowledge.empty_notebooks')
    expect(src).not.toContain('empty_notebooks_mobile')
    expect(src).toContain('headerRight')
    expect(src).not.toContain('TextInput')
    expect(src).not.toContain('Alert.alert')
  })

  it('should delete a notebook from official cards after a countdown dialog', () => {
    expect(src).toContain('<Card')
    expect(src).toContain('mobileDeleteNotebook')
    expect(src).toContain('KnowledgeNotebookDeleteDialog')
    expect(src).toContain("from '@baishou/ui/native'")
    expect(src).not.toContain('#fff')
    expect(src).not.toContain('#666')
  })
})

