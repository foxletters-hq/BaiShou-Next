import type { DiaryCmPlatform } from '@baishou/ui/shared/diary-codemirror'
import { logDiaryBridge } from '@baishou/ui/shared/diary-codemirror/diaryBridgeDebug'
import type { DiaryCmTheme } from '@baishou/ui/shared/diary-codemirror/types'

import type { InitPayload, WebViewToRnMessage } from './types'
import { diaryEditorState, pendingUrlRequests, urlCache } from './diary-editor-state'

export function postToNative(message: WebViewToRnMessage): void {
  window.ReactNativeWebView?.postMessage(JSON.stringify(message))
}

export function logEditor(tag: string, detail?: Record<string, unknown>): void {
  logDiaryBridge('diaryCm', tag, detail)
}

export function requestAttachmentUrl(srcRaw: string): string {
  const cached = urlCache.get(srcRaw)
  if (cached) return cached

  const existingRequestId = [...pendingUrlRequests.entries()].find(([, src]) => src === srcRaw)?.[0]
  if (!existingRequestId) {
    const requestId = `url-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    pendingUrlRequests.set(requestId, srcRaw)
    postToNative({ type: 'resolveUrlRequest', payload: { requestId, srcRaw } })
  }

  return srcRaw
}

export function buildPlatform(
  init: InitPayload,
  deps: { reportContentMetrics: () => void }
): DiaryCmPlatform {
  return {
    resolveAttachmentUrl(srcRaw: string) {
      if (!srcRaw.startsWith('attachment/')) return srcRaw
      return requestAttachmentUrl(srcRaw)
    },
    onImageAction(action, payload) {
      postToNative({
        type: 'imageAction',
        payload: {
          action,
          from: payload.from,
          to: payload.to,
          srcRaw: payload.srcRaw
        }
      })
    },
    onExternalImagePreview(resolvedSrc) {
      postToNative({
        type: 'imagePreview',
        payload: { srcRaw: resolvedSrc, resolvedUrl: resolvedSrc }
      })
    },
    onImageTap({ to }) {
      if (!diaryEditorState.view) return
      let pos = to
      const doc = diaryEditorState.view.state.doc
      if (pos < doc.length && doc.sliceString(pos, pos + 1) === '\n') pos += 1
      diaryEditorState.view.dispatch({ selection: { anchor: pos, head: pos } })
      diaryEditorState.view.focus()
      window.requestAnimationFrame(() => deps.reportContentMetrics())
    },
    interactionMode: init.interactionMode,
    tagLineMode: init.tagLineMode,
    scrollMode: init.scrollMode ?? 'document'
  }
}

function codeBlockSurface(theme: DiaryCmTheme): string {
  return theme.isDark ? '#2a2e38' : '#eceef2'
}

function inlineCodeSurface(theme: DiaryCmTheme): string {
  return theme.isDark ? '#32363f' : '#f0f2f5'
}

export function applyTheme(theme: DiaryCmTheme): void {
  const root = document.documentElement
  root.dataset.theme = theme.isDark ? 'dark' : 'light'
  root.style.setProperty('--text-primary', theme.textPrimary)
  root.style.setProperty('--text-secondary', theme.textSecondary)
  root.style.setProperty('--text-tertiary', theme.textSecondary)
  root.style.setProperty('--bg-editor', theme.bgEditor)
  root.style.setProperty('--bg-surface', theme.bgEditor)
  root.style.setProperty('--bg-surface-normal', inlineCodeSurface(theme))
  root.style.setProperty('--bg-code-block', codeBlockSurface(theme))
  root.style.setProperty('--border-subtle', theme.borderColor)
  root.style.setProperty('--color-danger', theme.isDark ? '#f87171' : '#e5484d')
  root.style.setProperty('--color-primary', theme.primary)
  root.style.setProperty(
    '--color-primary-light',
    `color-mix(in srgb, ${theme.primary} 35%, transparent)`
  )
  theme.tagColors.forEach((fg, index) => {
    root.style.setProperty(`--tag-${index}-fg`, fg)
  })
  document.body.style.backgroundColor = theme.bgEditor
  document.body.style.color = theme.textPrimary
}
