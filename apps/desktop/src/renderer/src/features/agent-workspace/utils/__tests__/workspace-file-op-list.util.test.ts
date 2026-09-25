import { describe, expect, it } from 'vitest'
import {
  formatFileOpActionLabel,
  formatWorkspaceFileOpListTitle
} from '../workspace-file-op-list.util'

const t = (key: string, fallback: string, options?: { count: number }) =>
  fallback.replace('{{count}}', String(options?.count ?? ''))

describe('formatWorkspaceFileOpListTitle', () => {
  it('should mark running writes as pending confirmation', () => {
    expect(formatWorkspaceFileOpListTitle(true, 4, t)).toBe('待确认写入 4 个文件')
  })

  it('should keep completed writes as edited', () => {
    expect(formatWorkspaceFileOpListTitle(false, 2, t)).toBe('编辑了 2 个文件')
  })
})

describe('formatFileOpActionLabel', () => {
  it('should use future tense while waiting for confirmation', () => {
    expect(formatFileOpActionLabel(t, 'create', true)).toBe('将新建')
    expect(formatFileOpActionLabel(t, 'create', false)).toBe('新建')
  })
})