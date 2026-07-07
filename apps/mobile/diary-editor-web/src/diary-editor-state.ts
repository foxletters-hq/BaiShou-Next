import { Compartment } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import type { DiaryCmTheme } from '@baishou/ui/shared/diary-codemirror/types'

export const DIARY_CM_FEATURE_TAG = 'live-preview-inline-fenced-v20'

export const diaryEditorState = {
  view: null as EditorView | null,
  suppressChangeEcho: false,
  contentHeightObserver: null as ResizeObserver | null,
  activeScrollMode: 'document' as 'viewport' | 'document',
  bottomScrollInsetPx: 0,
  keyboardVisible: false,
  caretScrollFrameId: null as number | null,
  suppressCaretScrollOnce: false,
  suppressCaretScrollUntil: 0,
  userScrollLockUntil: 0,
  programmaticScroll: false,
  scrollListenerInstalled: false,
  touchInteractionDidPan: false,
  touchInteractionStartX: null as number | null,
  touchInteractionStartY: null as number | null,
  touchInteractionStartAt: null as number | null,
  suppressCaretScrollFromClickUntil: 0,
  touchPanLastY: null as number | null,
  touchPanRelayInstalled: false,
  touchPanDisabled: false
}

export const USER_SCROLL_LOCK_MS = 3000
export const TOUCH_PAN_THRESHOLD_PX = 10
export const CARET_SCROLL_BOTTOM_BUFFER_PX = 12
export const CARET_SCROLL_KEYBOARD_EXTRA_PX = 28
export const CARET_SCROLL_TOP_BUFFER_PX = 48
export const CARET_BOTTOM_BUFFER_PX = 96

export const editableCompartment = new Compartment()

export const urlCache = new Map<string, string>()
export const pendingUrlRequests = new Map<string, string>()

export const DEFAULT_THEME: DiaryCmTheme = {
  isDark: false,
  textPrimary: '#111827',
  textSecondary: '#6b7280',
  bgEditor: '#ffffff',
  borderColor: '#e5e7eb',
  primary: '#5ba8f5',
  tagColors: ['#60A5FA', '#34D399', '#F59E0B', '#A78BFA']
}
