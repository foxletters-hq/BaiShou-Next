import type { DiaryCmMarkdownMark } from '../../shared/diary-codemirror/types'

export interface CodeMirrorEditorHandle {
  insertAtCursor: (text: string) => void
  insertWrappedText: (prefix: string, suffix?: string) => void
  undo: () => void
  redo: () => void
  toggleMarkdownMark: (marker: DiaryCmMarkdownMark) => void
  focus: () => void
}

export interface CodeMirrorEditorProps {
  content: string
  onChange: (value: string) => void
  placeholder?: string
  basePath?: string
  onPasteFiles?: (files: File[]) => Promise<string[]>
  onDropFiles?: (files: File[]) => Promise<string[]>
}

export interface TextContextMenuState {
  x: number
  y: number
  hasSelection: boolean
}
