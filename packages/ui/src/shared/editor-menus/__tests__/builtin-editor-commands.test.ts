import { describe, it, expect, beforeEach } from 'vitest'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import {
  BuiltinEditorCommandId,
  registerBuiltinEditorCommands,
  resetBuiltinEditorCommandsForTests
} from '../builtin-editor-commands'
import { resetCommandRegistryForTests } from '../command-registry'
import type { EditorMenuContext } from '../editor-menu-context'
import { MenuId } from '../menu-id'
import { resetMenuRegistryForTests, resolveMenuItems } from '../menu-registry'

function createView(doc = 'hello'): EditorView {
  const parent = document.createElement('div')
  document.body.appendChild(parent)
  return new EditorView({
    state: EditorState.create({ doc }),
    parent
  })
}

function buildContext(
  view: EditorView,
  overrides: Partial<EditorMenuContext> = {}
): EditorMenuContext {
  const { from, to } = view.state.selection.main
  return {
    view,
    hasSelection: from !== to,
    readOnly: view.state.readOnly,
    ...overrides
  }
}

describe('builtin-editor-commands', () => {
  beforeEach(() => {
    resetCommandRegistryForTests()
    resetMenuRegistryForTests()
    resetBuiltinEditorCommandsForTests()
    registerBuiltinEditorCommands()
  })

  it('should keep cut paste undo visible but disabled when readOnly', () => {
    const view = createView()
    try {
      const items = resolveMenuItems(
        MenuId.EditorContext,
        buildContext(view, { readOnly: true, hasSelection: true })
      )
      const byId = new Map(
        items
          .filter((item) => item.type === 'command')
          .map((item) =>
            item.type === 'command' ? ([item.commandId, item.disabled] as const) : ['', false]
          )
      )

      expect(byId.get(BuiltinEditorCommandId.Cut)).toBe(true)
      expect(byId.get(BuiltinEditorCommandId.Copy)).toBe(false)
      expect(byId.get(BuiltinEditorCommandId.Paste)).toBe(true)
      expect(byId.get(BuiltinEditorCommandId.Undo)).toBe(true)
      expect(byId.get(BuiltinEditorCommandId.SelectAll)).toBe(false)
    } finally {
      view.destroy()
    }
  })

  it('should disable copy and cut when no selection', () => {
    const view = createView()
    try {
      const items = resolveMenuItems(
        MenuId.EditorContext,
        buildContext(view, { readOnly: false, hasSelection: false })
      )
      const byId = new Map(
        items
          .filter((item) => item.type === 'command')
          .map((item) =>
            item.type === 'command' ? ([item.commandId, item.disabled] as const) : ['', false]
          )
      )

      expect(byId.get(BuiltinEditorCommandId.Copy)).toBe(true)
      expect(byId.get(BuiltinEditorCommandId.Cut)).toBe(true)
      expect(byId.get(BuiltinEditorCommandId.Paste)).toBe(false)
    } finally {
      view.destroy()
    }
  })

  it('should order cut copy paste then undo selectAll with icons', () => {
    const view = createView()
    try {
      const items = resolveMenuItems(
        MenuId.EditorContext,
        buildContext(view, { readOnly: false, hasSelection: true })
      )
      expect(items.map((item) => (item.type === 'command' ? item.commandId : 'sep'))).toEqual([
        BuiltinEditorCommandId.Cut,
        BuiltinEditorCommandId.Copy,
        BuiltinEditorCommandId.Paste,
        'sep',
        BuiltinEditorCommandId.Undo,
        BuiltinEditorCommandId.SelectAll
      ])
      expect(
        items
          .filter((item) => item.type === 'command')
          .map((item) => (item.type === 'command' ? item.iconId : undefined))
      ).toEqual(['cut', 'copy', 'paste', 'undo', 'selectAll'])
    } finally {
      view.destroy()
    }
  })

  it('should be idempotent when registerBuiltinEditorCommands called twice', () => {
    registerBuiltinEditorCommands()
    const view = createView()
    try {
      const items = resolveMenuItems(
        MenuId.EditorContext,
        buildContext(view, { readOnly: false, hasSelection: true })
      )
      const commands = items.filter((item) => item.type === 'command')
      expect(commands).toHaveLength(5)
    } finally {
      view.destroy()
    }
  })
})
