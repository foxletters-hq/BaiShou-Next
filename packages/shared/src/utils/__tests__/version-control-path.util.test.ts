import { describe, expect, it } from 'vitest'
import { isBinaryDiffPath, isTextDiffablePath } from '../version-control-path.util'

describe('version-control-path.util', () => {
  it('blocks images and extensionless vault paths from text diff', () => {
    expect(isTextDiffablePath('Personal/Journals/2026/05/13.md')).toBe(true)
    expect(isTextDiffablePath('Personal/attachments/photo.png')).toBe(false)
    expect(isTextDiffablePath('是')).toBe(false)
    expect(isBinaryDiffPath('Personal/attachments/photo.png')).toBe(true)
  })
})
