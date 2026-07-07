import i18n from 'i18next'
import { redo, undo } from '@codemirror/commands'
import { toggleMarkdownMark } from '@baishou/ui/shared/diary-codemirror'
import { logDiaryBridge } from '@baishou/ui/shared/diary-codemirror/diaryBridgeDebug'
import { resolveTableConfirmResponse } from '@baishou/ui/shared/diary-codemirror/table/tableConfirm'
import { resolveNativeTableSheetResponse } from '@baishou/ui/shared/diary-codemirror/table/tableNativeSheet'

import {
  applyTagColorRegistry,
  deleteRange,
  handleResolveUrlResponse,
  insertAtCursor,
  setContent,
  setEditable,
  setSelection
} from './diary-editor-commands'
import { mountEditor } from './diary-editor-mount'
import { logEditor, postToNative } from './diary-editor-platform'
import {
  scheduleEnsureCaretVisible,
  scheduleForcedCaretScroll,
  scrollEditorToBottomInstant,
  setScrollInsets,
  shouldPinScrollToBottomDuringMount
} from './diary-editor-scroll'
import { DIARY_CM_FEATURE_TAG, DEFAULT_THEME, diaryEditorState } from './diary-editor-state'
import type { RnToWebViewMessage } from './types'

declare const __DIARY_EDITOR_BUILD_ID__: string | undefined

function handleRnMessage(raw: unknown): void {
  let message: RnToWebViewMessage
  try {
    message = typeof raw === 'string' ? JSON.parse(raw) : (raw as RnToWebViewMessage)
  } catch {
    return
  }

  try {
    handleRnMessageInner(message)
  } catch (error) {
    logDiaryBridge('diaryCm', 'webviewCommandError', {
      type: message.type,
      message: error instanceof Error ? error.message : String(error)
    })
  }
}

function handleRnMessageInner(message: RnToWebViewMessage): void {
  switch (message.type) {
    case 'init':
      mountEditor(message.payload)
      break
    case 'setContent':
      setContent(message.payload.content)
      break
    case 'deleteRange':
      deleteRange(message.payload.from, message.payload.to)
      break
    case 'setTagColorRegistry':
      applyTagColorRegistry(message.payload.registry)
      break
    case 'insertAtCursor':
      insertAtCursor(message.payload.text)
      break
    case 'toggleMarkdownMark':
      if (diaryEditorState.view) toggleMarkdownMark(diaryEditorState.view, message.payload.marker)
      break
    case 'undo':
      if (diaryEditorState.view) undo(diaryEditorState.view)
      break
    case 'redo':
      if (diaryEditorState.view) redo(diaryEditorState.view)
      break
    case 'setSelection':
      setSelection(message.payload.start, message.payload.end)
      break
    case 'setEditable':
      setEditable(message.payload.editable)
      break
    case 'setScrollInsets':
      setScrollInsets(message.payload)
      break
    case 'scrollCaretIntoView':
      scheduleForcedCaretScroll()
      break
    case 'focus':
      diaryEditorState.view?.focus()
      diaryEditorState.userScrollLockUntil = 0
      if (shouldPinScrollToBottomDuringMount()) {
        scrollEditorToBottomInstant()
      } else {
        scheduleEnsureCaretVisible()
      }
      break
    case 'blur':
      diaryEditorState.view?.dom.blur()
      break
    case 'resolveUrlResponse':
      handleResolveUrlResponse(message.payload.requestId, message.payload.url)
      break
    case 'confirmResponse':
      resolveTableConfirmResponse(message.payload.requestId, message.payload.confirmed)
      break
    case 'tableSheetResponse':
      resolveNativeTableSheetResponse(message.payload)
      break
    case 'requestReady':
      postToNative({ type: 'ready' })
      break
  }
}

function listenForNativeMessages(): void {
  const handler = (event: Event) => {
    const data = (event as MessageEvent).data
    if (typeof data === 'string' || (typeof data === 'object' && data !== null)) {
      handleRnMessage(data)
    }
  }

  document.addEventListener('message', handler as EventListener)
  window.addEventListener('message', handler)
}

function exposeNativeMessageBridge(): void {
  ;(
    window as unknown as { __diaryCmOnNativeMessage?: (raw: unknown) => void }
  ).__diaryCmOnNativeMessage = handleRnMessage
}

export function bootstrap(): void {
  listenForNativeMessages()
  exposeNativeMessageBridge()

  // 浏览器本地调试：无 RN 宿主时直接挂载
  if (!window.ReactNativeWebView) {
    mountEditor({
      content: i18n.t(
        'auto.apps.mobile.diary.editor.web.src.diary.editor.messages.L138',
        '# Hello\n\nWebView bundle 已加载（shared diary-codemirror）。'
      ),
      placeholder: i18n.t(
        'auto.apps.mobile.diary.editor.web.src.diary.editor.messages.L139',
        '记录下这一刻...'
      ),
      theme: DEFAULT_THEME,
      interactionMode: 'touch',
      editable: true
    })
    return
  }

  const sendReady = () => {
    logEditor('ready', {
      featureTag: DIARY_CM_FEATURE_TAG,
      buildId:
        typeof __DIARY_EDITOR_BUILD_ID__ !== 'undefined' ? __DIARY_EDITOR_BUILD_ID__ : '(none)'
    })
    postToNative({ type: 'ready' })
  }

  // 协议：WebView 就绪后通知 RN，RN 再发 init
  sendReady()
  // 部分 Android 设备 onMessage 挂载晚于首帧，补发 ready
  window.setTimeout(sendReady, 120)
  window.setTimeout(sendReady, 500)
}
