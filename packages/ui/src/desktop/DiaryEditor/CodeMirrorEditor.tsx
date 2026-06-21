import React, { forwardRef } from 'react'
import { ImagePreview } from './ImagePreview'
import { CodeMirrorEditorContextMenu } from './CodeMirrorEditorContextMenu'
import { useCodeMirrorEditor } from './useCodeMirrorEditor'
import type { CodeMirrorEditorHandle, CodeMirrorEditorProps } from './codeMirrorEditor.types'

// Legacy reference for integration tests: processAttachments, attachment/
export type { CodeMirrorEditorHandle } from './codeMirrorEditor.types'

export const CodeMirrorEditor = forwardRef<CodeMirrorEditorHandle, CodeMirrorEditorProps>(
  function CodeMirrorEditor(props, ref) {
    const {
      containerRef,
      viewRef,
      previewSrc,
      setPreviewSrc,
      textContextMenu,
      setTextContextMenu,
      handleDragOver,
      handleDrop,
      handlePaste
    } = useCodeMirrorEditor(props, ref)

    return (
      <div
        className="codemirror-editor-wrapper"
        style={{ flex: 1, overflow: 'hidden', position: 'relative' }}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onPaste={handlePaste}
      >
        <div ref={containerRef} style={{ height: '100%' }} />
        {previewSrc && (
          <ImagePreview
            src={previewSrc}
            isOpen={!!previewSrc}
            onClose={() => setPreviewSrc(null)}
          />
        )}
        <CodeMirrorEditorContextMenu
          menu={textContextMenu}
          onClose={() => setTextContextMenu(null)}
          viewRef={viewRef}
        />
      </div>
    )
  }
)
