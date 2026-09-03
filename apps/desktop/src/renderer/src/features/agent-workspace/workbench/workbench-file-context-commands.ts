import {
  appendMenuItem,
  getCommand,
  MenuId,
  registerCommand,
  type EditorMenuContext
} from '@baishou/ui'
import { commentPopoverAnchorFromSelectionCoords } from './workbench-comment-popover.util'

export const WORKBENCH_ADD_FILE_CONTEXT_EVENT = 'baishou:workbench-add-file-context'
export const WORKBENCH_COMMENT_FILE_CONTEXT_EVENT = 'baishou:workbench-comment-file-context'

export type WorkbenchFileContextRangeDetail = {
  startLine: number
  endLine: number
  x?: number
  y?: number
}

export const WorkbenchFileContextCommandId = {
  AddSelection: 'workbench.fileContext.addSelection',
  CommentSelection: 'workbench.fileContext.commentSelection'
} as const

let registered = false

function emitRange(eventName: string, ctx: EditorMenuContext): void {
  const { from, to, head } = ctx.view.state.selection.main
  const startLine = ctx.view.state.doc.lineAt(from).number
  const endLine = ctx.view.state.doc.lineAt(Math.max(from, to > from ? to - 1 : to)).number
  const endPos = Math.max(from, to)
  const coords = ctx.view.coordsAtPos(endPos) ?? ctx.view.coordsAtPos(head)
  window.dispatchEvent(
    new CustomEvent<WorkbenchFileContextRangeDetail>(eventName, {
      detail: {
        startLine: Math.min(startLine, endLine),
        endLine: Math.max(startLine, endLine),
        ...commentPopoverAnchorFromSelectionCoords(coords)
      }
    })
  )
}

export function registerWorkbenchFileContextCommands(): void {
  if (registered) return
  registered = true

  if (!getCommand(WorkbenchFileContextCommandId.AddSelection)) {
    registerCommand<EditorMenuContext>({
      id: WorkbenchFileContextCommandId.AddSelection,
      labelKey: 'workbench.add_selection_to_chat',
      defaultLabel: '将选区加入对话',
      isEnabled: (ctx) => ctx.hasSelection,
      run: (ctx) => emitRange(WORKBENCH_ADD_FILE_CONTEXT_EVENT, ctx)
    })
  }
  if (!getCommand(WorkbenchFileContextCommandId.CommentSelection)) {
    registerCommand<EditorMenuContext>({
      id: WorkbenchFileContextCommandId.CommentSelection,
      labelKey: 'workbench.comment_selection',
      defaultLabel: '评论此选区',
      isEnabled: (ctx) => ctx.hasSelection,
      run: (ctx) => emitRange(WORKBENCH_COMMENT_FILE_CONTEXT_EVENT, ctx)
    })
  }

  appendMenuItem<EditorMenuContext>({
    menuId: MenuId.EditorContext,
    commandId: WorkbenchFileContextCommandId.AddSelection,
    group: 'a_workbench',
    order: 1
  })
  appendMenuItem<EditorMenuContext>({
    menuId: MenuId.EditorContext,
    commandId: WorkbenchFileContextCommandId.CommentSelection,
    group: 'a_workbench',
    order: 2
  })
}
