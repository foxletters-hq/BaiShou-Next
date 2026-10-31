import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const src = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../useBranchSession.ts'),
  'utf8'
)

describe('useBranchSession vault & branch title chrome', () => {
  it('should branch companion sessions with the live vault helper', () => {
    expect(src).toContain('loadMobileSessionInActiveVault')
    expect(src).toContain('resolveMobileActiveVaultId')
    expect(src).not.toContain('assertMobileSessionInActiveVault')
  })

  it('优先使用原会话标题并附带分支点消息摘要，且保留原消息时间戳', () => {
    expect(src).toContain('buildBranchSessionTitle')
    expect(src).toContain('originalTitle: originalSession.title')
    expect(src).toContain('branchPointSnippet: extractMessagePlainTextSnippet(targetMsg?.parts)')
    expect(src).toContain('createdAt: msg.createdAt')
  })
})
