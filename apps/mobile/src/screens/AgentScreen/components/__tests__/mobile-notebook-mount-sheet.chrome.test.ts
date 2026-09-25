import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const src = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'MobileNotebookMountSheet.tsx'),
  'utf8'
)

describe('mobile notebook mount sheet chrome', () => {
  it('should use the official modal and checkbox with theme tokens', () => {
    expect(src).toContain("from '@baishou/ui/native'")
    expect(src).toContain('Modal')
    expect(src).toContain('Checkbox')
    expect(src).toContain('useNativeTheme')
    expect(src).not.toContain("Modal } from 'react-native'")
    expect(src).not.toContain('#fff')
    expect(src).not.toContain('#666')
    expect(src).toContain('setPendingMountedNotebookIds')
    expect(src).not.toContain('notebook_mount_need_session')
  })
})
