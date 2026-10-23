import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const dir = dirname(fileURLToPath(import.meta.url))
const editor = readFileSync(join(dir, '..', 'WorkbenchLivePreviewEditor.tsx'), 'utf8')

describe('workbench live preview links', () => {
  it('should open a rendered http link in the system browser', () => {
    expect(editor).toContain('onOpenExternalLink')
    expect(editor).toContain('window.api.shell.openExternal')
  })
})
