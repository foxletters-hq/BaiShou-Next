import { EditorView } from '@codemirror/view'
import { forceImageRefresh } from '@baishou/ui/shared/diary-codemirror'
import { diarySyntaxTreeGrowthEffect } from '@baishou/ui/shared/diary-codemirror/extensions/diarySyntaxTreeGrowth'
import {
  refreshDiaryTagColorRegistryEffect,
  setActiveDiaryTagColorRegistry
} from '@baishou/ui/shared/diary-codemirror/extensions/diaryTagLinePlugin'

import {
  scheduleEnsureCaretVisible,
  scrollEditorToBottomInstant,
  shouldPinScrollToBottomDuringMount
} from './diary-editor-scroll'
import {
  diaryEditorState,
  editableCompartment,
  pendingUrlRequests,
  urlCache
} from './diary-editor-state'

export function setEditable(editable: boolean): void {
  if (!diaryEditorState.view) return
  diaryEditorState.view.dispatch({
    effects: editableCompartment.reconfigure(EditorView.editable.of(editable))
  })
}

export function setContent(content: string): void {
  if (!diaryEditorState.view) return
  const current = diaryEditorState.view.state.doc.toString()
  if (content === current) return

  // 聚焦编辑中：拒绝「把已删后缀塞回来」的滞后 RN setContent（长按删除时光标会跑到文字前）
  if (
    diaryEditorState.view.hasFocus &&
    content.length > current.length &&
    content.startsWith(current)
  ) {
    return
  }

  const { anchor, head } = diaryEditorState.view.state.selection.main
  const scrollTop = diaryEditorState.view.scrollDOM.scrollTop
  const mapPos = (pos: number) => Math.max(0, Math.min(pos, content.length))

  diaryEditorState.suppressChangeEcho = true
  diaryEditorState.suppressCaretScrollOnce = true
  diaryEditorState.view.dispatch({
    changes: { from: 0, to: current.length, insert: content },
    selection: { anchor: mapPos(anchor), head: mapPos(head) },
    effects: diarySyntaxTreeGrowthEffect.of(null),
    scrollIntoView: false
  })
  diaryEditorState.view.scrollDOM.scrollTop = scrollTop
  requestAnimationFrame(() => {
    if (!diaryEditorState.view) return
    diaryEditorState.view.dispatch({ effects: diarySyntaxTreeGrowthEffect.of(null) })
  })
  diaryEditorState.suppressChangeEcho = false
}

export function deleteRange(from: number, to: number): void {
  if (!diaryEditorState.view) return
  const doc = diaryEditorState.view.state.doc
  const safeFrom = Math.max(0, Math.min(from, doc.length))
  const safeTo = Math.max(safeFrom, Math.min(to, doc.length))
  if (safeFrom === safeTo) return

  const savedScrollTop = diaryEditorState.view.scrollDOM.scrollTop
  diaryEditorState.suppressCaretScrollOnce = true
  diaryEditorState.view.dispatch({
    changes: { from: safeFrom, to: safeTo, insert: '' },
    selection: { anchor: safeFrom, head: safeFrom },
    scrollIntoView: false
  })
  diaryEditorState.view.scrollDOM.scrollTop = savedScrollTop
}

export function insertAtCursor(text: string): void {
  if (!diaryEditorState.view) return
  const { from, to } = diaryEditorState.view.state.selection.main
  diaryEditorState.view.dispatch({
    changes: { from, to, insert: text },
    selection: { anchor: from + text.length }
  })
  diaryEditorState.view.focus()
}

export function setSelection(start: number, end: number): void {
  if (!diaryEditorState.view) return
  diaryEditorState.view.dispatch({ selection: { anchor: start, head: end }, scrollIntoView: false })
  if (shouldPinScrollToBottomDuringMount()) {
    scrollEditorToBottomInstant()
    return
  }
  scheduleEnsureCaretVisible()
}

export function handleResolveUrlResponse(requestId: string, url: string | null): void {
  const srcRaw = pendingUrlRequests.get(requestId)
  if (!srcRaw) return

  pendingUrlRequests.delete(requestId)
  if (url) {
    urlCache.set(srcRaw, url)
  }

  if (diaryEditorState.view) {
    diaryEditorState.view.dispatch({ effects: forceImageRefresh.of(null) })
  }
}

export function applyTagColorRegistry(registry: Record<string, number> | undefined): void {
  const next = registry ?? {}
  setActiveDiaryTagColorRegistry(next)
  if (diaryEditorState.view) {
    diaryEditorState.view.dispatch({ effects: refreshDiaryTagColorRegistryEffect.of(next) })
  }
}
