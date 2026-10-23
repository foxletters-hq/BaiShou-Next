import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))

describe('native input bar skill cite chrome', () => {
  it('should render skill refs as in-composer cites that open a preview', () => {
    const index = readFileSync(join(here, '../index.tsx'), 'utf8')
    const hook = readFileSync(join(here, '../useNativeInputBar.tsx'), 'utf8')
    expect(index).toContain('NativeSkillCiteChip')
    expect(index).toContain('SkillCitePreviewDialog')
    expect(index).toContain('styles.skillCiteRow')
    expect(index).toContain('styles.inputCard')
    expect(hook).toContain('removeSkillRef')
    expect(hook).toContain('applyShortcut')
    expect(hook).toContain("prev.startsWith('/') ? '' : prev")
    expect(hook).not.toContain('${token}')
  })
})
