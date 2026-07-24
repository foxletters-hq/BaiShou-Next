import { undo } from '@codemirror/commands'
import { logger } from '@baishou/shared'
import { registerCommand } from './command-registry'
import type { EditorMenuContext } from './editor-menu-context'
import { MenuId } from './menu-id'
import { appendMenuItem } from './menu-registry'

export const BuiltinEditorCommandId = {
  Copy: 'editor.clipboard.copy',
  Cut: 'editor.clipboard.cut',
  Paste: 'editor.clipboard.paste',
  Undo: 'editor.undo',
  SelectAll: 'editor.selectAll'
} as const

let registered = false

async function runCopy(): Promise<void> {
  document.execCommand('copy')
}

async function runCut(ctx: EditorMenuContext): Promise<void> {
  if (ctx.readOnly) return
  document.execCommand('cut')
}

async function runPaste(ctx: EditorMenuContext): Promise<void> {
  if (ctx.readOnly) return
  try {
    const text = await navigator.clipboard.readText()
    const { view } = ctx
    const { from, to } = view.state.selection.main
    view.dispatch({
      changes: { from, to, insert: text },
      selection: { anchor: from + text.length }
    })
    view.focus()
  } catch (err) {
    logger.error('Editor paste failed:', err instanceof Error ? err : String(err))
  }
}

function runUndo(ctx: EditorMenuContext): void {
  if (ctx.readOnly) return
  undo(ctx.view)
  ctx.view.focus()
}

function runSelectAll(ctx: EditorMenuContext): void {
  const { view } = ctx
  view.dispatch({
    selection: { anchor: 0, head: view.state.doc.length }
  })
  view.focus()
}

/**
 * 注册内置正文编辑命令与 EditorContext 菜单贡献。
 * 幂等：多次调用只会注册一次。
 * 菜单顺序对齐常见笔记编辑器：剪切 / 复制 / 粘贴 → 撤销 / 全选。
 */
export function registerBuiltinEditorCommands(): void {
  if (registered) return
  registered = true

  registerCommand<EditorMenuContext>({
    id: BuiltinEditorCommandId.Cut,
    labelKey: 'common.cut',
    defaultLabel: '剪切',
    iconId: 'cut',
    isEnabled: (ctx) => !ctx.readOnly && ctx.hasSelection,
    run: (ctx) => runCut(ctx)
  })

  registerCommand<EditorMenuContext>({
    id: BuiltinEditorCommandId.Copy,
    labelKey: 'common.copy',
    defaultLabel: '复制',
    iconId: 'copy',
    isEnabled: (ctx) => ctx.hasSelection,
    run: () => runCopy()
  })

  registerCommand<EditorMenuContext>({
    id: BuiltinEditorCommandId.Paste,
    labelKey: 'common.paste',
    defaultLabel: '粘贴',
    iconId: 'paste',
    isEnabled: (ctx) => !ctx.readOnly,
    run: (ctx) => runPaste(ctx)
  })

  registerCommand<EditorMenuContext>({
    id: BuiltinEditorCommandId.Undo,
    labelKey: 'common.undo',
    defaultLabel: '撤销',
    iconId: 'undo',
    isEnabled: (ctx) => !ctx.readOnly,
    run: (ctx) => runUndo(ctx)
  })

  registerCommand<EditorMenuContext>({
    id: BuiltinEditorCommandId.SelectAll,
    labelKey: 'common.select_all',
    defaultLabel: '全选',
    iconId: 'selectAll',
    run: (ctx) => runSelectAll(ctx)
  })

  // Obsidian 式：始终展示剪贴板项，只读时禁用而非隐藏
  appendMenuItem<EditorMenuContext>({
    menuId: MenuId.EditorContext,
    commandId: BuiltinEditorCommandId.Cut,
    group: '9_cutcopypaste',
    order: 1
  })
  appendMenuItem<EditorMenuContext>({
    menuId: MenuId.EditorContext,
    commandId: BuiltinEditorCommandId.Copy,
    group: '9_cutcopypaste',
    order: 2
  })
  appendMenuItem<EditorMenuContext>({
    menuId: MenuId.EditorContext,
    commandId: BuiltinEditorCommandId.Paste,
    group: '9_cutcopypaste',
    order: 3
  })
  appendMenuItem<EditorMenuContext>({
    menuId: MenuId.EditorContext,
    commandId: BuiltinEditorCommandId.Undo,
    group: 'z_commands',
    order: 1
  })
  appendMenuItem<EditorMenuContext>({
    menuId: MenuId.EditorContext,
    commandId: BuiltinEditorCommandId.SelectAll,
    group: 'z_commands',
    order: 2
  })
}

/** 仅供单测重置内置注册幂等标记 */
export function resetBuiltinEditorCommandsForTests(): void {
  registered = false
}
