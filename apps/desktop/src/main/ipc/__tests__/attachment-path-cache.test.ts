import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { isPathUnderAllowedRoots } from '../attachment-path-cache'

describe('isPathUnderAllowedRoots', () => {
  const roots = {
    attachmentsBase: path.join('D:', 'Vaults', 'Personal', 'Attachments'),
    journalsBase: path.join('D:', 'Vaults', 'Personal', 'Journals')
  }

  it('allows files under attachments root', () => {
    const file = path.join(roots.attachmentsBase, 'session-id', 'photo.png')
    expect(isPathUnderAllowedRoots(file, roots)).toBe(true)
  })

  it('allows files under journals root', () => {
    const file = path.join(roots.journalsBase, '2026', '06', 'attachment', 'img.png')
    expect(isPathUnderAllowedRoots(file, roots)).toBe(true)
  })

  it('rejects paths outside allowed roots', () => {
    const file = path.join('D:', 'Other', 'secret.png')
    expect(isPathUnderAllowedRoots(file, roots)).toBe(false)
  })

  it('rejects sibling directories that share a prefix', () => {
    const file = path.join('D:', 'Vaults', 'PersonalBackup', 'Attachments', 'photo.png')
    expect(isPathUnderAllowedRoots(file, roots)).toBe(false)
  })
})
