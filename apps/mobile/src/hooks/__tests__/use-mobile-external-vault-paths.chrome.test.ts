import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const src = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../useMobileExternalVaultPaths.ts'),
  'utf8'
)

describe('useMobileExternalVaultPaths chrome', () => {
  it('uses custom wording for journals and summaries buttons', () => {
    expect(src).toContain("'自定义日记目录'")
    expect(src).toContain("'自定义总结目录'")
    expect(src).not.toContain("'选择日记目录'")
    expect(src).not.toContain("'选择总结目录'")
  })

  it('prompts user with explanation notice before picking directory to prevent misoperation', () => {
    expect(src).toContain('storage.external_journals_pick_notice')
    expect(src).toContain('storage.external_summaries_pick_notice')
    expect(src).toContain('storage.external_pick_continue')

    // 确认在 openDirectoryPicker 中是在 pickUserDirectory 之前调用 dialog.confirm
    const noticeIdx = src.indexOf('dialog.confirm(notice')
    const pickIdx = src.indexOf('pickUserDirectory()')
    expect(noticeIdx).toBeGreaterThan(0)
    expect(pickIdx).toBeGreaterThan(noticeIdx)
  })
})
