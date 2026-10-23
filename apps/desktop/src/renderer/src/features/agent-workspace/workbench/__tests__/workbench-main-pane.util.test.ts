import { describe, expect, it } from 'vitest'
import {
  addSelectionShortcutLabel,
  commentPopoverPosition,
  isPositiveLine,
  splitRelativePath,
  tabIconName
} from '../workbench-main-pane.util'

describe('splitRelativePath', () => {
  it('should drop empty segments when the path uses mixed separators', () => {
    expect(splitRelativePath('src\\lib/util.ts')).toEqual(['src', 'lib', 'util.ts'])
    expect(splitRelativePath('/only/file.md')).toEqual(['only', 'file.md'])
    expect(splitRelativePath('')).toEqual([])
  })
})

describe('tabIconName', () => {
  it('should prefer the relative path over the tab title', () => {
    expect(tabIconName({ title: 'util.ts', relativePath: 'src/lib/util.ts' })).toBe(
      'src/lib/util.ts'
    )
    expect(tabIconName({ title: 'README.md' })).toBe('README.md')
  })
})

describe('isPositiveLine', () => {
  it('should accept only finite line numbers starting at 1', () => {
    expect(isPositiveLine(1)).toBe(true)
    expect(isPositiveLine(12)).toBe(true)
    expect(isPositiveLine(0)).toBe(false)
    expect(isPositiveLine(-2)).toBe(false)
    expect(isPositiveLine(Number.NaN)).toBe(false)
    expect(isPositiveLine('3')).toBe(false)
  })
})

describe('addSelectionShortcutLabel', () => {
  it('should show the Mac shortcut when the platform is Apple', () => {
    expect(addSelectionShortcutLabel('MacIntel')).toBe('⌘⇧L')
    expect(addSelectionShortcutLabel('iPhone')).toBe('⌘⇧L')
  })

  it('should show the Windows shortcut for other platforms', () => {
    expect(addSelectionShortcutLabel('Win32')).toBe('Ctrl+Shift+L')
    expect(addSelectionShortcutLabel('')).toBe('Ctrl+Shift+L')
  })
})

describe('commentPopoverPosition', () => {
  it('should clamp the popover into the supplied viewport', () => {
    expect(commentPopoverPosition({ x: -10, y: 900 }, { width: 800, height: 600 })).toEqual({
      x: 12,
      y: 408
    })
  })
})
