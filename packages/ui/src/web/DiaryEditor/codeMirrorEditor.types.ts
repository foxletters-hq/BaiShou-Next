export interface CodeMirrorEditorHandle {
  insertAtCursor: (text: string) => void
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
