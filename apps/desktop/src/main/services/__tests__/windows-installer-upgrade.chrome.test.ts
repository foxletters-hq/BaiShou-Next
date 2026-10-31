import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))

function read(rel: string): string {
  return readFileSync(join(here, rel), 'utf8')
}

describe('Windows installer upgrade coverage and single-instance startup', () => {
  it('should default to per-user privileges while preserving existing install mode on upgrade', () => {
    const iss = read('../../../../setup.iss')
    expect(iss).toContain('PrivilegesRequired=lowest')
    expect(iss).toContain('PrivilegesRequiredOverridesAllowed=commandline')
    expect(iss).toContain('UsePreviousPrivileges=yes')
    expect(iss).toMatch(/\[Run\][\s\S]*Flags:[^\r\n]*\brunasoriginaluser\b/)
  })

  it('should detect running BaiShou.exe via file lock instead of spawning cmd.exe pipelines', () => {
    const iss = read('../../../../setup.iss')
    expect(iss).not.toContain("ExpandConstant('{cmd}')")
    expect(iss).not.toContain('tasklist')
    expect(iss).not.toContain('findstr')
    expect(iss).toContain('TFileStream.Create')
    expect(iss).toContain("ExpandConstant('{sys}\\taskkill.exe')")
  })

  it('should enforce single-instance lock and focus existing window on second launch', () => {
    const mainIndex = read('../../index.ts')
    expect(mainIndex).toContain('app.requestSingleInstanceLock()')
    expect(mainIndex).toContain("app.on('second-instance'")
    expect(mainIndex).toContain('focusMainWindow()')
  })
})
