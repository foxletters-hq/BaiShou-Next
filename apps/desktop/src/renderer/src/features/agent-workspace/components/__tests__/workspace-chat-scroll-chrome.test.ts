import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const componentsDir = join(here, '..')
const desktopStyles = join(here, '../../../../styles/index.css')

function readComponent(fileName: string): string {
  return readFileSync(join(componentsDir, fileName), 'utf8')
}

describe('workspace chat scroll chrome', () => {
  it('should keep a visible right-edge scrollbar on the workspace conversation list', () => {
    const list = readComponent('AgentWorkspaceMessageList.tsx')
    const css = readComponent('AgentWorkspaceMessageList.module.css')
    const globalCss = readFileSync(desktopStyles, 'utf8')

    expect(list).toContain('data-workspace-chat-scroll')
    expect(css).toMatch(/\.scroll \{[^}]*overflow-y: auto/)
    expect(css).toMatch(/\.scroll \{[^}]*scrollbar-gutter: stable/)
    expect(globalCss).toContain('[data-workspace-chat-scroll]')
    expect(globalCss).toContain('scrollbar-width: thin !important')
    expect(globalCss).toContain('display: block !important')
  })
})
