import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))

function read(rel: string): string {
  return readFileSync(join(here, rel), 'utf8')
}

describe('RagMemoryOrganizeModal chrome', () => {
  it('should keep the organizing title only on the modal, not again in the status row', () => {
    const modal = read('../RagMemoryOrganizeModal.tsx')
    const alerts = read('../RagMemoryAlerts.tsx')
    expect(modal).toContain('memory.readiness_organizing')
    expect(modal).toContain('surface="organize"')
    expect(alerts).toContain('showOrganizeStatusTitle')
    expect(alerts).toContain("surface !== 'organize'")
  })

  it('should keep the done title only on the modal, not again in the body', () => {
    const modal = read('../RagMemoryOrganizeModal.tsx')
    expect((modal.match(/memory\.organize_done/g) ?? []).length).toBe(1)
    expect(modal).toContain('memory.organize_incomplete')
    expect(modal).toContain('memory.organize_continue')
    expect(modal).toContain('common.got_it')
    expect(modal).not.toContain('organizeDoneText')
  })

  it('should keep organize pause and cancel on the right of a footer row', () => {
    const alerts = read('../RagMemoryAlerts.tsx')
    const css = read('../RagMemoryView.module.css')
    expect(alerts).toContain("surface === 'organize' ? styles.organizeDoneActions")
    expect(alerts).toContain("surface !== 'organize' && batchEmbedActionButtons")
    expect(css).toMatch(/\.organizeDoneActions \{[^}]*justify-content: flex-end/s)
  })
})
