import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'index.ts'), 'utf8')

describe('desktop startup defer chrome', () => {
  it('should start PDF vision and MCP after the window is shown', () => {
    expect(src).toContain('scheduleDesktopPostWindowInit')
    expect(src).toContain('runDesktopPostWindowInit')
    expect(src).toContain("markStartup('window.show')")
    expect(src).toMatch(
      /markStartup\('window\.show'\)\s*\n\s*scheduleDesktopPostWindowInit\(\(\) => runDesktopPostWindowInit\(\)\)/
    )
  })

  it('should keep PDF extractors and MCP out of the pre-window bootstrap path', () => {
    expect(src).not.toContain('registerDesktopPdfPageExtractor()')
    expect(src).not.toContain('bootstrapMcpServer()')
  })
})
