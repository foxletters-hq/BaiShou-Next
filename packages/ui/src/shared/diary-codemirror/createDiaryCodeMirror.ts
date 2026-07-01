import { EditorState, Prec, type Extension } from '@codemirror/state'
import {
  EditorView,
  keymap,
  placeholder as cmPlaceholder,
  highlightActiveLine
} from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { searchKeymap } from '@codemirror/search'
import { livePreviewPlugin } from './extensions/livePreviewPlugin'
import { livePreviewSyntaxHighlighting } from './extensions/syntax'
import { markdownKeymap } from './extensions/keymap'
import {
  editorTheme,
  mobileTouchEditorLayoutTheme,
  mobileTouchViewportTheme
} from './theme/editorTheme'
import { attachmentUrlPlugin } from './extensions/attachmentUrlPlugin'
import { diaryTagLineKeymap, diaryTagLinePlugin } from './extensions/diaryTagLinePlugin'
import { listContinuationExtension } from './extensions/listContinuationKeymap'
import { tableCellExtension } from './extensions/tableCellKeymap'
import { tableEditorPlugin } from './extensions/tableEditorPlugin'
import type { DiaryCmPlatform } from './types'

export interface CreateDiaryCodeMirrorOptions {
  content: string
  placeholder?: string
  platform: DiaryCmPlatform
  onChange?: (content: string) => void
  extraExtensions?: Extension[]
}

export function createDiaryCodeMirrorExtensions(
  options: CreateDiaryCodeMirrorOptions
): Extension[] {
  const { placeholder, platform, onChange, extraExtensions = [] } = options
  const resolveUrl = platform.resolveAttachmentUrl.bind(platform)
  const isTouch = platform.interactionMode === 'touch'
  const scrollMode = platform.scrollMode ?? 'document'
  const touchLayout =
    isTouch && scrollMode === 'viewport'
      ? mobileTouchViewportTheme
      : isTouch
        ? mobileTouchEditorLayoutTheme
        : null

  return [
    EditorView.lineWrapping,
    highlightActiveLine(),
    history(),
    ...(platform.tagLineMode ? [Prec.high(diaryTagLineKeymap), diaryTagLinePlugin] : []),
    tableCellExtension,
    tableEditorPlugin,
    listContinuationExtension,
    markdownKeymap,
    keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap, indentWithTab]),
    markdown({ base: markdownLanguage }),
    cmPlaceholder(placeholder || ''),
    livePreviewPlugin(platform),
    livePreviewSyntaxHighlighting(),
    attachmentUrlPlugin(resolveUrl),
    ...(onChange
      ? [
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              onChange(update.state.doc.toString())
            }
          })
        ]
      : []),
    EditorView.domEventHandlers({
      click: (event) => {
        const target = event.target as HTMLElement
        if (target.closest('.cm-image-container')) {
          return false
        }
        if (target.tagName === 'IMG') {
          const src = (target as HTMLImageElement).src
          if (src && !src.startsWith('attachment/')) {
            platform.onExternalImagePreview?.(src)
          }
        }
        return false
      }
    }),
    editorTheme,
    ...(touchLayout ? [touchLayout] : []),
    ...extraExtensions
  ]
}

export function createDiaryCodeMirror(
  parent: HTMLElement,
  options: CreateDiaryCodeMirrorOptions
): EditorView {
  const state = EditorState.create({
    doc: options.content,
    extensions: createDiaryCodeMirrorExtensions(options)
  })
  return new EditorView({ state, parent })
}
