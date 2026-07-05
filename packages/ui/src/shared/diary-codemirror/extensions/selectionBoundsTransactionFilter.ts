import {
  EditorSelection,
  EditorState,
  type Annotation,
  type Extension,
  type Transaction,
  type TransactionSpec
} from '@codemirror/state'
import type { EditorView } from '@codemirror/view'
import { clampPosToDoc } from '../editorContentSync'

function resolveNewDocLength(
  state: Transaction['startState'],
  spec: Pick<TransactionSpec, 'changes'>
): number {
  if (!spec.changes) return state.doc.length
  return state.changes(spec.changes).newLength
}

function clampSelectionToLength(
  selection: NonNullable<TransactionSpec['selection']>,
  docLength: number,
  state?: Transaction['startState']
): EditorSelection {
  if (typeof selection === 'function') {
    if (!state) throw new Error('selection function requires start state')
    const resolved = (selection as (s: EditorState) => EditorSelection)(state)
    return clampSelectionToLength(resolved, docLength, state)
  }
  if (selection instanceof EditorSelection) {
    const ranges = selection.ranges.map((range) =>
      EditorSelection.range(
        clampPosToDoc(range.anchor, docLength),
        clampPosToDoc(range.head, docLength)
      )
    )
    return EditorSelection.create(ranges, selection.mainIndex)
  }
  if (Array.isArray(selection)) {
    const ranges = selection.map((range) =>
      EditorSelection.range(
        clampPosToDoc(range.anchor, docLength),
        clampPosToDoc(range.head, docLength)
      )
    )
    return EditorSelection.create(ranges, 0)
  }
  return EditorSelection.single(
    clampPosToDoc(selection.anchor, docLength),
    clampPosToDoc(selection.head ?? selection.anchor, docLength)
  )
}

export function clampTransactionSelection(
  state: Transaction['startState'],
  spec: TransactionSpec
): TransactionSpec {
  if (!spec.selection) return spec
  const newLength = resolveNewDocLength(state, spec)
  return {
    ...spec,
    selection: clampSelectionToLength(spec.selection, newLength, state)
  }
}

function selectionNeedsClamp(selection: EditorSelection, docLength: number): boolean {
  return selection.ranges.some(
    (range) =>
      range.anchor < 0 ||
      range.anchor > docLength ||
      range.head < 0 ||
      range.head > docLength
  )
}

/** 拦截非法选区，避免 ckant / 外部同步正文时抛出 RangeError */
export function selectionBoundsTransactionFilter(): Extension {
  return EditorState.transactionFilter.of((tr) => {
    const sel = tr.selection
    if (!sel) return tr

    const len = tr.newDoc.length
    if (!selectionNeedsClamp(sel, len)) return tr

    const ranges = sel.ranges.map((range) =>
      EditorSelection.range(
        clampPosToDoc(range.anchor, len),
        clampPosToDoc(range.head, len)
      )
    )
    const clamped = EditorSelection.create(ranges, sel.mainIndex)
    const annotations = (tr as Transaction & { annotations?: readonly Annotation<unknown>[] })
      .annotations

    return tr.startState.update({
      changes: tr.changes,
      selection: clamped,
      effects: tr.effects,
      annotations,
      scrollIntoView: tr.scrollIntoView,
      filter: false
    })
  })
}

/** 在 dispatch 入口钳制选区（filter 之前 CM 就会校验 spec，必须包一层） */
export function installSafeEditorDispatch(view: EditorView): void {
  const rawDispatch = view.dispatch.bind(view)
  const wrapped: EditorView['dispatch'] = (...args) => {
    if (args.length === 1) {
      const first = args[0]
      if (first && typeof first === 'object' && 'startState' in first) {
        rawDispatch(first as Transaction)
        return
      }
      if (Array.isArray(first)) {
        rawDispatch(first as readonly Transaction[])
        return
      }
      rawDispatch(clampTransactionSelection(view.state, first as TransactionSpec))
      return
    }
    rawDispatch(...(args as TransactionSpec[]))
  }
  view.dispatch = wrapped
}
