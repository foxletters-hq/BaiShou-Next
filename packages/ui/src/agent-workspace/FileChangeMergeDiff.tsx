import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { EditorState, type Extension } from '@codemirror/state'
import { EditorView, keymap, lineNumbers } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { MergeView, unifiedMergeView } from '@codemirror/merge'
import {
  editorContextMenuExtension,
  workbenchEditorTheme,
  type EditorContextMenuOpenPayload
} from '../shared/diary-codemirror'
import { EditorContextMenuHost } from '../desktop/ContextMenu/EditorContextMenuHost'
import { languageExtensionForPath } from './file-change-language'
import {
  workbenchSelectionAffordance,
  type WorkbenchSelectionAffordanceState
} from './workbench-selection-affordance'
import styles from './FileChangeMergeDiff.module.css'

export type FileChangeMergeSelectionHandle = {
  getSelectionLines: () => { startLine: number; endLine: number } | null
}

function selectionFromView(
  view: EditorView | null | undefined
): { startLine: number; endLine: number } | null {
  if (!view) return null
  if (view.state.selection.ranges.length !== 1) return null
  const { from, to } = view.state.selection.main
  if (from === to) return null
  const startLine = view.state.doc.lineAt(from).number
  const endLine = view.state.doc.lineAt(Math.max(from, to - 1)).number
  return {
    startLine: Math.min(startLine, endLine),
    endLine: Math.max(startLine, endLine)
  }
}

export type FileChangeMergeViewMode = 'inline' | 'side-by-side'

export interface FileChangeMergeDiffProps {
  path: string
  original: string
  modified: string
  viewMode?: FileChangeMergeViewMode
  /** When true (default), modified side is editable; original stays read-only. */
  modifiedEditable?: boolean
  onModifiedChange?: (content: string) => void
  className?: string
  onSelectionAffordanceChange?: (state: WorkbenchSelectionAffordanceState | null) => void
}

const mergeTheme = EditorView.theme({
  '&': {
    height: '100%',
    // Match WorkbenchLivePreviewEditor / workbenchEditorTheme
    fontSize: 'var(--ui-fs-xl, var(--content-font-size-lg, 16px))'
  },
  '.cm-scroller': {
    fontFamily: 'var(--font-family-main, var(--font-family, inherit))',
    lineHeight: '1.5',
    background: 'var(--bg-surface)'
  },
  '.cm-content': {
    padding: '8px 0 24px'
  },
  '.cm-gutters': {
    background: 'var(--bg-app)',
    borderRight: '1px solid var(--border-muted)',
    color: 'var(--text-tertiary, var(--text-secondary))'
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'transparent'
  },
  '.cm-activeLine': {
    backgroundColor: 'transparent'
  },
  '.cm-merge-a .cm-changedLine, .cm-deletedChunk': {
    backgroundColor: 'rgba(248, 81, 73, 0.12)'
  },
  '.cm-merge-b .cm-changedLine, .cm-insertedLine': {
    backgroundColor: 'rgba(46, 160, 67, 0.12)'
  },
  '.cm-deletedText, .cm-change.cm-change-del': {
    backgroundColor: 'rgba(248, 81, 73, 0.28)'
  },
  '.cm-insertedText, .cm-change.cm-change-ins': {
    backgroundColor: 'rgba(46, 160, 67, 0.28)'
  }
})

type OpenMenu = (payload: EditorContextMenuOpenPayload) => void

function baseExtensions(path: string): Extension[] {
  const lang = languageExtensionForPath(path)
  return [
    lineNumbers(),
    history(),
    keymap.of([...defaultKeymap, ...historyKeymap]),
    EditorView.lineWrapping,
    workbenchEditorTheme,
    mergeTheme,
    EditorView.editorAttributes.of({ class: 'workbench-cm-editor file-change-merge-editor' }),
    ...(lang ? [lang] : [])
  ]
}

function originalSideExtensions(path: string, onOpenMenu: OpenMenu): Extension[] {
  return [
    ...baseExtensions(path),
    EditorState.readOnly.of(true),
    EditorView.editable.of(false),
    editorContextMenuExtension({
      readOnly: true,
      docUri: path,
      onOpen: onOpenMenu
    })
  ]
}

function modifiedSideExtensions(
  path: string,
  editable: boolean,
  onModifiedChangeRef: React.MutableRefObject<((content: string) => void) | undefined>,
  suppressEchoRef: React.MutableRefObject<boolean>,
  onOpenMenu: OpenMenu,
  onSelectionAffordanceChangeRef: React.MutableRefObject<
    ((state: WorkbenchSelectionAffordanceState | null) => void) | undefined
  >
): Extension[] {
  const extensions: Extension[] = [
    ...baseExtensions(path),
    editorContextMenuExtension({
      readOnly: !editable,
      docUri: path,
      onOpen: onOpenMenu
    }),
    workbenchSelectionAffordance((state) => {
      onSelectionAffordanceChangeRef.current?.(state)
    })
  ]
  if (!editable) {
    extensions.push(EditorState.readOnly.of(true), EditorView.editable.of(false))
    return extensions
  }
  extensions.push(
    EditorView.updateListener.of((update) => {
      if (!update.docChanged || suppressEchoRef.current) return
      onModifiedChangeRef.current?.(update.state.doc.toString())
    })
  )
  return extensions
}

export const FileChangeMergeDiff = forwardRef<
  FileChangeMergeSelectionHandle,
  FileChangeMergeDiffProps
>(function FileChangeMergeDiff(
  {
    path,
    original,
    modified,
    viewMode = 'inline',
    modifiedEditable = true,
    onModifiedChange,
    className,
    onSelectionAffordanceChange
  },
  ref
) {
  const hostRef = useRef<HTMLDivElement>(null)
  const mergeViewRef = useRef<MergeView | null>(null)
  const unifiedViewRef = useRef<EditorView | null>(null)
  const onModifiedChangeRef = useRef(onModifiedChange)
  const onSelectionAffordanceChangeRef = useRef(onSelectionAffordanceChange)
  const suppressEchoRef = useRef(false)
  const [textContextMenu, setTextContextMenu] = useState<EditorContextMenuOpenPayload | null>(null)
  const onOpenMenuRef = useRef<OpenMenu>((payload) => setTextContextMenu(payload))

  useEffect(() => {
    onModifiedChangeRef.current = onModifiedChange
  }, [onModifiedChange])

  useEffect(() => {
    onSelectionAffordanceChangeRef.current = onSelectionAffordanceChange
  }, [onSelectionAffordanceChange])

  useImperativeHandle(
    ref,
    () => ({
      getSelectionLines: () => selectionFromView(mergeViewRef.current?.b ?? unifiedViewRef.current)
    }),
    []
  )

  useEffect(() => {
    onOpenMenuRef.current = (payload) => setTextContextMenu(payload)
  }, [])

  // Recreate only when document identity / mode / editability changes — not on every keystroke.
  useEffect(() => {
    const host = hostRef.current
    if (!host) return undefined

    host.replaceChildren()
    mergeViewRef.current = null
    unifiedViewRef.current = null
    setTextContextMenu(null)

    const onOpenMenu: OpenMenu = (payload) => onOpenMenuRef.current(payload)

    if (viewMode === 'side-by-side') {
      const merge = new MergeView({
        a: {
          doc: original,
          extensions: originalSideExtensions(path, onOpenMenu)
        },
        b: {
          doc: modified,
          extensions: modifiedSideExtensions(
            path,
            modifiedEditable,
            onModifiedChangeRef,
            suppressEchoRef,
            onOpenMenu,
            onSelectionAffordanceChangeRef
          )
        },
        parent: host,
        gutter: true,
        collapseUnchanged: { margin: 3, minSize: 6 }
      })
      mergeViewRef.current = merge

      return () => {
        setTextContextMenu(null)
        merge.destroy()
        mergeViewRef.current = null
      }
    }

    const view = new EditorView({
      parent: host,
      state: EditorState.create({
        doc: modified,
        extensions: [
          ...modifiedSideExtensions(
            path,
            modifiedEditable,
            onModifiedChangeRef,
            suppressEchoRef,
            onOpenMenu,
            onSelectionAffordanceChangeRef
          ),
          unifiedMergeView({
            original,
            mergeControls: false,
            gutter: true,
            highlightChanges: true,
            syntaxHighlightDeletions: true,
            collapseUnchanged: { margin: 3, minSize: 6 }
          })
        ]
      })
    })
    unifiedViewRef.current = view

    return () => {
      setTextContextMenu(null)
      view.destroy()
      unifiedViewRef.current = null
    }
    // intentionally omit `modified` — synced below
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recreate on identity/mode
  }, [path, original, viewMode, modifiedEditable])

  // External modified sync (disk reload / parent reset), not echo from local typing.
  useEffect(() => {
    const merge = mergeViewRef.current
    if (merge) {
      const current = merge.b.state.doc.toString()
      if (current === modified) return
      suppressEchoRef.current = true
      merge.b.dispatch({
        changes: { from: 0, to: merge.b.state.doc.length, insert: modified }
      })
      suppressEchoRef.current = false
      return
    }

    const view = unifiedViewRef.current
    if (!view) return
    const current = view.state.doc.toString()
    if (current === modified) return
    suppressEchoRef.current = true
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: modified }
    })
    suppressEchoRef.current = false
  }, [modified])

  return (
    <>
      <div ref={hostRef} className={`${styles.root} ${className ?? ''}`.trim()} />
      <EditorContextMenuHost
        menu={textContextMenu}
        onClose={() => setTextContextMenu(null)}
        variant="context-menu"
      />
    </>
  )
})
