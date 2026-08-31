import { describe, expect, it } from 'vitest'
import { shouldListWorkbenchTreeEntry } from '../workbench-tree-list.util'

describe('shouldListWorkbenchTreeEntry', () => {
  it('lists ordinary files and folders', () => {
    expect(shouldListWorkbenchTreeEntry('README.md')).toBe(true)
    expect(shouldListWorkbenchTreeEntry('设定')).toBe(true)
    expect(shouldListWorkbenchTreeEntry('node_modules')).toBe(true)
  })

  it('lists dotfiles and dotted folders that are not default excludes', () => {
    expect(shouldListWorkbenchTreeEntry('.gitignore')).toBe(true)
    expect(shouldListWorkbenchTreeEntry('.env')).toBe(true)
    expect(shouldListWorkbenchTreeEntry('.github')).toBe(true)
    expect(shouldListWorkbenchTreeEntry('.cursor')).toBe(true)
    expect(shouldListWorkbenchTreeEntry('.vscode')).toBe(true)
    expect(shouldListWorkbenchTreeEntry('.editorconfig')).toBe(true)
    expect(shouldListWorkbenchTreeEntry('.skill')).toBe(true)
    expect(shouldListWorkbenchTreeEntry('.agents')).toBe(true)
  })

  it('hides version-control directories and system junk files at any depth', () => {
    expect(shouldListWorkbenchTreeEntry('.git', { ignoreCase: true })).toBe(false)
    expect(shouldListWorkbenchTreeEntry('.svn', { ignoreCase: true })).toBe(false)
    expect(shouldListWorkbenchTreeEntry('.hg', { ignoreCase: true })).toBe(false)
    expect(shouldListWorkbenchTreeEntry('.DS_Store', { ignoreCase: true })).toBe(false)
    expect(shouldListWorkbenchTreeEntry('Thumbs.db', { ignoreCase: true })).toBe(false)
  })

  it('treats excluded names as case-insensitive when ignoreCase is on', () => {
    expect(shouldListWorkbenchTreeEntry('.GIT', { ignoreCase: true })).toBe(false)
    expect(shouldListWorkbenchTreeEntry('thumbs.DB', { ignoreCase: true })).toBe(false)
    expect(shouldListWorkbenchTreeEntry('.GIT', { ignoreCase: false })).toBe(true)
    expect(shouldListWorkbenchTreeEntry('thumbs.DB', { ignoreCase: false })).toBe(true)
  })
})
