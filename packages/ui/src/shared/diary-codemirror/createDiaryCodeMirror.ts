import { EditorState, Prec, Transaction, type Extension } from '@codemirror/state'
import {
  EditorView,
  keymap,
  placeholder as cmPlaceholder,
  highlightActiveLine,
  type ViewUpdate
} from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { searchKeymap } from '@codemirror/search'
import { livePreviewField } from './extensions/livePreviewPlugin'
import { tablePreviewField } from './extensions/tablePreviewField'
import { imagePreviewPlugin } from './extensions/imagePreviewPlugin'
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
import { inlineMarkEnterExtension } from './extensions/inlineMarkEnterKeymap'
import { tableCellExtension } from './extensions/tableCellKeymap'
import {
  tableEditorPlugin,
  tableAtomicRanges,
  tableBoundaryBackspaceKeymap
} from './extensions/tableEditorPlugin'
import { tablePostTableTouchPlugin } from './extensions/tablePostTableTouchPlugin'
import {
  diarySyntaxTreeGrowthPlugin,
  diarySyntaxTreeGrowthEffect
} from './extensions/diarySyntaxTreeGrowth'
import { activeTableCellField } from './table/tableActiveCell'
import { tableCellEditingField } from './table/tableCellEditing'
import { tableChromeSelectionField } from './table/tableChromeSelection'
import { tableCellRangeSelectionField } from './table/tableRangeSelection'
import { tableRangeKeymap } from './table/tableRangeKeymap'
import { tableWidgetSyncPlugin } from './extensions/tableWidgetSyncPlugin'
import { tableChromeTouchPlugin } from './extensions/tableChromeTouchPlugin'
import {
  diaryMarkdownTableAutocompletionExt,
  diaryMarkdownTablesCkant,
  insertEmptyMarkdownTable
} from './table/desktop/markdownTablesCkant'
import { tableMenuI18nPlugin } from './table/desktop/tableMenuI18nPlugin'
import { insertEmptyMarkdownTableKeymap } from './table/markdownTableCommands'
import { selectionBoundsTransactionFilter, installSafeEditorDispatch } from './extensions/selectionBoundsTransactionFilter'
import { clampPosToDoc } from './editorContentSync'
import { diaryPostTableGapNormalize } from './table/tableEffects'
import type { DiaryCmPlatform } from './types'

function isPostTableGapNormalizeUpdate(update: ViewUpdate): boolean {
  return update.transactions.every(
    (tr) => !tr.docChanged || tr.annotation(diaryPostTableGapNormalize) === true
  )
}

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
  const markdownSupport = markdown({ base: markdownLanguage })

  return [
    Prec.highest(selectionBoundsTransactionFilter()),
    EditorView.lineWrapping,
    highlightActiveLine(),
    history(),
    ...(platform.tagLineMode ? [Prec.high(diaryTagLineKeymap), diaryTagLinePlugin] : []),
    ...(isTouch
      ? [
          activeTableCellField,
          tableCellEditingField,
          tableChromeSelectionField,
          tableCellRangeSelectionField,
          tableWidgetSyncPlugin(platform),
          tableRangeKeymap()
        ]
      : [...diaryMarkdownTablesCkant(), tableMenuI18nPlugin(platform)]),
    keymap.of(
      isTouch
        ? insertEmptyMarkdownTableKeymap
        : [{ key: 'Mod-Shift-t', run: insertEmptyMarkdownTable() }]
    ),
    ...(isTouch
      ? [tableCellExtension, tableAtomicRanges, tableBoundaryBackspaceKeymap, tableEditorPlugin]
      : []),
    diarySyntaxTreeGrowthPlugin,
    ...(isTouch ? [tableChromeTouchPlugin(platform), tablePostTableTouchPlugin(platform)] : []),
    listContinuationExtension,
    inlineMarkEnterExtension,
    markdownKeymap,
    keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap, indentWithTab]),
    markdownSupport,
    ...(isTouch ? [] : diaryMarkdownTableAutocompletionExt(markdownSupport)),
    cmPlaceholder(placeholder || ''),
    ...(isTouch ? [tablePreviewField(platform)] : []),
    ...livePreviewField(platform),
    imagePreviewPlugin(platform),
    livePreviewSyntaxHighlighting(),
    attachmentUrlPlugin(resolveUrl),
    ...(onChange
      ? [
          EditorView.updateListener.of((update) => {
            if (!update.docChanged || isPostTableGapNormalizeUpdate(update)) return
            onChange(update.state.doc.toString())
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
  const extensions = createDiaryCodeMirrorExtensions(options)
  const view = new EditorView({
    parent,
    state: EditorState.create({ doc: '', extensions })
  })
  installSafeEditorDispatch(view)

  const content = options.content
  if (content.length > 0) {
    // 直接 create({ doc: 全文 }) 时 Lezer 常在 livePreview create 前未追到文末，
    // 导致 #/** 等隐藏装饰与标题样式无法进入 DOM（仅语法高亮仍可见）。
    const end = clampPosToDoc(content.length, content.length)
    view.dispatch({
      changes: { from: 0, insert: content },
      selection: { anchor: end, head: end },
      effects: diarySyntaxTreeGrowthEffect.of(null),
      annotations: Transaction.addToHistory.of(false),
      scrollIntoView: false
    })
    // WebView 首帧：同步 + 多帧补刷装饰
    const refreshDecorations = () => {
      if (!view.dom.isConnected) return
      view.dispatch({
        effects: diarySyntaxTreeGrowthEffect.of(null),
        scrollIntoView: false
      })
    }
    refreshDecorations()
    requestAnimationFrame(refreshDecorations)
    requestAnimationFrame(() => requestAnimationFrame(refreshDecorations))
  }

  return view
}
