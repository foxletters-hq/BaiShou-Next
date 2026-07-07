import { EditorState, type Annotation, type Transaction } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { createDiaryCodeMirror } from '@baishou/ui/shared/diary-codemirror'
import { diarySyntaxTreeGrowthEffect } from '@baishou/ui/shared/diary-codemirror/extensions/diarySyntaxTreeGrowth'
import {
  dismissKeyboardForSheetInteraction,
  isTableSheetOpen
} from '@baishou/ui/shared/diary-codemirror/table/tableSheetInteraction'
import {
  logTouchSelectionProbe,
  scheduleSelectionProbesAfterTouch
} from '@baishou/ui/shared/diary-codemirror/extensions/touchSelectionDebug'

import type { InitPayload } from './types'
import { applyTagColorRegistry } from './diary-editor-commands'
import { logEditor, postToNative, buildPlatform, applyTheme } from './diary-editor-platform'
import {
  cancelCaretScrollAnimation,
  finalizeInitialEditorScroll,
  forceCaretVisible,
  handleTouchPointerEnd,
  installUserScrollListener,
  noteTouchInteractionMove,
  noteTouchInteractionStart,
  noteUserCaretPlacement,
  reportContentMetrics,
  resetTouchInteractionState,
  scheduleEnsureCaretVisible,
  scrollEditorToBottomInstant,
  shouldPinScrollToBottomDuringMount,
  applyBottomScrollInset
} from './diary-editor-scroll'
import {
  DIARY_CM_FEATURE_TAG,
  DEFAULT_THEME,
  diaryEditorState,
  editableCompartment
} from './diary-editor-state'

declare const __DIARY_EDITOR_BUILD_ID__: string | undefined

function applyTouchViewportLayout(editorView: EditorView): void {
  document.documentElement.style.height = '100%'
  document.documentElement.style.overflow = 'hidden'
  document.body.style.height = '100%'
  document.body.style.overflow = 'hidden'
  const root = document.getElementById('root')
  if (root) {
    root.style.height = '100%'
    root.style.minHeight = '100%'
  }
  editorView.dom.style.height = '100%'
}

function applyTouchNoInternalScroll(editorView: EditorView): void {
  const { scrollDOM, dom } = editorView
  scrollDOM.style.overflow = 'visible'
  scrollDOM.style.height = 'auto'
  scrollDOM.style.maxHeight = 'none'
  dom.style.height = 'auto'
  document.documentElement.style.overflow = 'hidden'
  document.body.style.overflow = 'hidden'
  document.body.style.height = 'auto'
}

function shouldDisableTouchPanRelay(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  return !!target.closest(
    '.cm-table-handle, .cm-table-add-btn, .cm-table-corner-menu, .cm-table-context-menu, .cm-table-context-menu-layer, .cm-table-sheet-layer'
  )
}

function installTouchParentScrollRelay(): void {
  if (diaryEditorState.touchPanRelayInstalled) return
  diaryEditorState.touchPanRelayInstalled = true

  document.addEventListener(
    'touchstart',
    (e) => {
      diaryEditorState.touchPanDisabled = shouldDisableTouchPanRelay(e.target)
      if (diaryEditorState.touchPanDisabled || e.touches.length !== 1) {
        diaryEditorState.touchPanLastY = null
        return
      }
      diaryEditorState.touchPanLastY = e.touches[0]?.clientY ?? null
    },
    { passive: true, capture: true }
  )

  document.addEventListener(
    'touchmove',
    (e) => {
      if (
        diaryEditorState.touchPanDisabled ||
        diaryEditorState.touchPanLastY === null ||
        e.touches.length !== 1
      )
        return
      const y = e.touches[0]?.clientY ?? diaryEditorState.touchPanLastY
      const deltaY = diaryEditorState.touchPanLastY - y
      diaryEditorState.touchPanLastY = y
      if (Math.abs(deltaY) < 1) return
      e.preventDefault()
      postToNative({ type: 'panScroll', payload: { deltaY } })
    },
    { passive: false, capture: true }
  )

  const endTouchPan = () => {
    diaryEditorState.touchPanLastY = null
    diaryEditorState.touchPanDisabled = false
  }
  document.addEventListener('touchend', endTouchPan, { passive: true, capture: true })
  document.addEventListener('touchcancel', endTouchPan, { passive: true, capture: true })
}

function setupContentHeightObserver(editorView: EditorView): void {
  diaryEditorState.contentHeightObserver?.disconnect()
  diaryEditorState.contentHeightObserver = new ResizeObserver(() => {
    if (shouldPinScrollToBottomDuringMount()) {
      scrollEditorToBottomInstant()
    }
    reportContentMetrics()
  })
  diaryEditorState.contentHeightObserver.observe(editorView.contentDOM)
}

export function mountEditor(init: InitPayload): void {
  const container = document.getElementById('root')
  if (!container) return

  const theme = init.theme ?? DEFAULT_THEME
  applyTheme(theme)
  diaryEditorState.view?.destroy()
  delete window.__diaryCmPlaceCursorAfterTable
  diaryEditorState.scrollListenerInstalled = false
  diaryEditorState.contentHeightObserver?.disconnect()

  const editable = init.editable ?? true
  const isTouch = init.interactionMode === 'touch'
  const scrollMode = init.scrollMode ?? 'document'
  diaryEditorState.activeScrollMode = scrollMode
  if (isTouch) {
    window.__tableChromeDebug = true
    window.__diaryBridgeDebug = true
    window.__diaryCmPlaceCursorAfterTable = () => {
      forceCaretVisible()
    }
  }
  applyBottomScrollInset(init.scrollInsets?.bottom ?? 0)
  diaryEditorState.keyboardVisible = init.scrollInsets?.keyboardVisible ?? false

  const buildStamp =
    document.documentElement.innerHTML.match(/diary-editor-build:([^\s-]+)/)?.[1] ?? '(none)'
  logEditor('mountEditor', {
    featureTag: DIARY_CM_FEATURE_TAG,
    buildId:
      typeof __DIARY_EDITOR_BUILD_ID__ !== 'undefined' ? __DIARY_EDITOR_BUILD_ID__ : '(none)',
    buildStamp,
    interactionMode: init.interactionMode,
    scrollMode,
    bottomScrollInset: diaryEditorState.bottomScrollInsetPx,
    contentLength: init.content.length
  })

  diaryEditorState.suppressChangeEcho = true
  diaryEditorState.view = createDiaryCodeMirror(container, {
    content: init.content,
    placeholder: init.placeholder,
    platform: buildPlatform(init, { reportContentMetrics }),
    onChange: (content) => {
      if (!diaryEditorState.suppressChangeEcho) {
        postToNative({ type: 'change', payload: { content } })
      }
    },
    extraExtensions: [
      editableCompartment.of(EditorView.editable.of(editable)),
      ...(isTouch && scrollMode === 'viewport'
        ? [
            EditorState.transactionFilter.of((tr) => {
              if (!tr.selection || !tr.scrollIntoView) return tr
              // 合并 spec 的 scrollIntoView 是 OR 语义，附加 spec 关不掉；
              // 须重建事务，并用 filter:false 防止再次进入本 filter（否则栈溢出）。
              // Transaction.annotations 为运行时字段（类型未导出），需保留
              // allowTableStructureEdit 等注解供 tableEditorPlugin 判断
              const annotations = (
                tr as Transaction & { annotations?: readonly Annotation<unknown>[] }
              ).annotations
              return tr.startState.update({
                changes: tr.changes,
                selection: tr.selection,
                effects: tr.effects,
                annotations,
                scrollIntoView: false,
                filter: false
              })
            })
          ]
        : []),
      EditorView.updateListener.of((update) => {
        if (update.selectionSet) {
          const { from, to } = update.state.selection.main
          logEditor('selectionChange', {
            from,
            to,
            docLen: update.state.doc.length,
            docChanged: update.docChanged,
            selectedText: update.state.sliceDoc(from, to)
          })
          if (
            diaryEditorState.view &&
            init.interactionMode === 'touch' &&
            (from !== to || update.state.sliceDoc(from, to))
          ) {
            logTouchSelectionProbe(diaryEditorState.view, 'cm-selectionSet')
          }
          postToNative({ type: 'selectionChange', payload: { start: from, end: to } })
          if (init.interactionMode === 'touch') {
            noteUserCaretPlacement(from, update.state.doc.length)
            window.requestAnimationFrame(() => {
              reportContentMetrics()
              if (scrollMode === 'viewport' && from === to) {
                if (Date.now() >= diaryEditorState.suppressCaretScrollFromClickUntil) {
                  if (diaryEditorState.suppressCaretScrollOnce) {
                    diaryEditorState.suppressCaretScrollOnce = false
                  } else if (Date.now() < diaryEditorState.suppressCaretScrollUntil) {
                    // 初次挂载选区同步，不自动滚向光标
                  } else {
                    diaryEditorState.userScrollLockUntil = 0
                    scheduleEnsureCaretVisible()
                  }
                }
              }
            })
          }
        }
        if (update.docChanged && init.interactionMode === 'touch') {
          logEditor('docChanged', {
            docLen: update.state.doc.length,
            head: update.state.selection.main.head,
            changeCount: update.changes.length
          })
          window.requestAnimationFrame(() => {
            reportContentMetrics()
            if (scrollMode === 'viewport') {
              if (diaryEditorState.suppressCaretScrollOnce) {
                diaryEditorState.suppressCaretScrollOnce = false
              } else if (Date.now() < diaryEditorState.suppressCaretScrollUntil) {
                // 初次挂载期间不自动滚向光标
              } else {
                diaryEditorState.userScrollLockUntil = 0
                scheduleEnsureCaretVisible()
              }
            }
          })
        }
      }),
      EditorView.domEventHandlers({
        touchstart: (event) => {
          cancelCaretScrollAnimation()
          noteTouchInteractionStart(event)
          const target = event.target
          if (
            target instanceof Element &&
            target.closest(
              '.cm-table-handle, .cm-table-corner-menu, .cm-table-add-btn, .cm-table-context-menu-layer, .cm-table-sheet-layer'
            )
          ) {
            return false
          }
          return false
        },
        touchmove: (event) => {
          noteTouchInteractionMove(event)
          return false
        },
        touchend: (event) => {
          if (isTableSheetOpen()) {
            dismissKeyboardForSheetInteraction()
            resetTouchInteractionState()
            return false
          }
          const touch = event.changedTouches[0]
          if (diaryEditorState.view && touch && init.interactionMode === 'touch') {
            const durationMs =
              diaryEditorState.touchInteractionStartAt != null
                ? Date.now() - diaryEditorState.touchInteractionStartAt
                : undefined
            const touchMeta = {
              clientX: touch.clientX,
              clientY: touch.clientY,
              durationMs
            }
            scheduleSelectionProbesAfterTouch(diaryEditorState.view, touchMeta)
          }
          if (init.interactionMode === 'touch' && scrollMode === 'viewport') {
            handleTouchPointerEnd(event.target)
          } else {
            resetTouchInteractionState()
          }
          return false
        },
        touchcancel: () => {
          resetTouchInteractionState()
          return false
        },
        click: (_event) => {
          if (isTableSheetOpen()) {
            dismissKeyboardForSheetInteraction()
            return false
          }
          return false
        },
        focus: () => {
          if (isTableSheetOpen()) {
            dismissKeyboardForSheetInteraction()
            return false
          }
          postToNative({ type: 'focus' })
          if (init.interactionMode === 'touch' && scrollMode === 'viewport') {
            diaryEditorState.userScrollLockUntil = 0
            window.requestAnimationFrame(() => {
              if (!diaryEditorState.view) return
              if (shouldPinScrollToBottomDuringMount()) {
                scrollEditorToBottomInstant()
                return
              }
              const head = diaryEditorState.view.state.selection.main.head
              if (head <= 1 && diaryEditorState.view.state.doc.length > 1) {
                logEditor('caretScroll:skip', { reason: 'stale-head-on-focus', head })
                return
              }
              scheduleEnsureCaretVisible()
            })
          }
          return false
        },
        focusin: (event) => {
          if (isTableSheetOpen()) {
            dismissKeyboardForSheetInteraction()
            return false
          }
          if ((event.target as Element).closest('.cm-table-cell-source')) {
            window.requestAnimationFrame(() => reportContentMetrics())
          }
          return false
        },
        blur: () => {
          postToNative({ type: 'blur' })
          return false
        }
      })
    ]
  })

  applyBottomScrollInset(diaryEditorState.bottomScrollInsetPx)
  setupContentHeightObserver(diaryEditorState.view)
  if (isTouch) {
    if (scrollMode === 'viewport') {
      applyTouchViewportLayout(diaryEditorState.view)
      installUserScrollListener(diaryEditorState.view)
    } else {
      applyTouchNoInternalScroll(diaryEditorState.view)
      installTouchParentScrollRelay()
    }
  }

  const docLength = diaryEditorState.view.state.doc.length
  diaryEditorState.suppressCaretScrollOnce = true
  diaryEditorState.suppressCaretScrollUntil = Date.now() + 2000
  scrollEditorToBottomInstant()
  diaryEditorState.view.dispatch({
    selection: { anchor: docLength, head: docLength },
    scrollIntoView: false
  })
  scrollEditorToBottomInstant()

  applyTagColorRegistry(init.tagColorRegistry)
  reportContentMetrics()
  diaryEditorState.suppressChangeEcho = false

  requestAnimationFrame(() => {
    scrollEditorToBottomInstant()
    probeLivePreviewDom(0)
    finalizeInitialEditorScroll()
  })
}

function probeLivePreviewDom(attempt: number): void {
  const cellSources =
    diaryEditorState.view?.dom.querySelectorAll('.cm-table-cell-source').length ?? 0
  const tableBlocks = diaryEditorState.view?.dom.querySelectorAll('.cm-table-block').length ?? 0
  const headingMarks =
    (diaryEditorState.view?.dom.querySelectorAll('.cm-rendered-h1').length ?? 0) +
    (diaryEditorState.view?.dom.querySelectorAll('.cm-rendered-h2').length ?? 0) +
    (diaryEditorState.view?.dom.querySelectorAll('.cm-rendered-h3').length ?? 0) +
    (diaryEditorState.view?.dom.querySelectorAll('.cm-rendered-h4').length ?? 0) +
    (diaryEditorState.view?.dom.querySelectorAll('.cm-rendered-h5').length ?? 0) +
    (diaryEditorState.view?.dom.querySelectorAll('.cm-rendered-h6').length ?? 0)
  const hiddenWidgets =
    diaryEditorState.view?.dom.querySelectorAll('.cm-syntax-hidden-widget').length ?? 0
  const hiddenMarks =
    diaryEditorState.view?.dom.querySelectorAll('.cm-markdown-syntax-hidden').length ?? 0
  const fencedCodeLines = diaryEditorState.view?.dom.querySelectorAll('.cm-code-line').length ?? 0
  const hiddenSyntaxCount = hiddenWidgets + hiddenMarks
  const firstLineText =
    diaryEditorState.view?.dom.querySelector('.cm-line')?.textContent?.slice(0, 48) ?? ''
  const docLen = diaryEditorState.view?.state.doc.length ?? 0
  const needsRetry = docLen > 0 && headingMarks === 0 && hiddenSyntaxCount === 0 && attempt < 6
  logEditor('mountEditor:dom', {
    tableBlocks,
    cellSources,
    headingMarks,
    hiddenWidgets,
    hiddenMarks,
    hiddenSyntaxCount,
    fencedCodeLines,
    firstLineText,
    attempt,
    scrollerClientHeight: diaryEditorState.view?.scrollDOM.clientHeight ?? 0,
    scrollerScrollHeight: diaryEditorState.view?.scrollDOM.scrollHeight ?? 0
  })
  if (needsRetry) {
    diaryEditorState.view?.dispatch({ effects: diarySyntaxTreeGrowthEffect.of(null) })
    if (shouldPinScrollToBottomDuringMount()) {
      scrollEditorToBottomInstant()
    }
    window.setTimeout(() => probeLivePreviewDom(attempt + 1), 50 * (attempt + 1))
  } else if (shouldPinScrollToBottomDuringMount()) {
    scrollEditorToBottomInstant()
  }
}
