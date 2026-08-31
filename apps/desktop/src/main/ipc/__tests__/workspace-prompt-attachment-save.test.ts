import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const src = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../agent-attachment.ipc.ts'),
  'utf8'
)

describe('workspace prompt attachment save', () => {
  it('keeps workspace files as path refs instead of copying into the vault attachment library', () => {
    expect(src).toContain('getWorkspaceSessionBinding')
    expect(src).toContain('planWorkspacePromptAttachment')
    expect(src).toContain('decorateWorkspacePromptAttachment')
    expect(src).toContain('baishou-workbench-prompt')
    expect(src).toContain("plan.mode === 'image-snapshot'")
    expect(src).toContain('copyFile')
    expect(src).toMatch(/workspaceBinding\?\.folderRoot/)
  })
})
