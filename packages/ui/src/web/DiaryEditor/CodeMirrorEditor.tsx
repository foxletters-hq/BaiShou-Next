import React, {
  useRef,
  useEffect,
  useCallback,
  useState,
  forwardRef,
  useImperativeHandle,
} from 'react';
import { EditorState } from '@codemirror/state';
import {
  EditorView,
  keymap,
  placeholder as cmPlaceholder,
  drawSelection,
  highlightActiveLine,
  lineNumbers,
} from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { searchKeymap } from '@codemirror/search';
import { ImagePreview } from './ImagePreview';
import { livePreviewPlugin, livePreviewSyntaxHighlighting, forceImageRefresh, setUpdateImageWidthCallback, setMoveToImageCallback } from './codeMirrorDecorations';
import { editorTheme } from './codeMirrorTheme';
import { attachmentUrlPlugin } from './codeMirrorAttachmentPlugin';
import { parseImageMarkdown, buildImageMarkdown } from './image-utils';

export interface CodeMirrorEditorHandle {
  insertAtCursor: (text: string) => void;
}

interface CodeMirrorEditorProps {
  content: string;
  onChange: (value: string) => void;
  placeholder?: string;
  basePath?: string;
  onPasteFiles?: (files: File[]) => Promise<string[]>;
  onDropFiles?: (files: File[]) => Promise<string[]>;
}

function toggleMarkdownMark(view: EditorView, marker: string): boolean {
  const { from, to } = view.state.selection.main;
  const selText = view.state.sliceDoc(from, to);
  const mLen = marker.length;

  // 选中文字：用 marker 包裹
  if (selText.length > 0) {
    // 检查选区外侧是否已被该标记包裹 → 是则去掉
    const before = view.state.sliceDoc(Math.max(0, from - mLen), from);
    const after = view.state.sliceDoc(to, to + mLen);
    if (before === marker && after === marker) {
      view.dispatch({
        changes: [
          { from: to, to: to + mLen },
          { from: from - mLen, to: from },
        ],
        selection: { anchor: from - mLen, head: to },
      });
    } else {
      view.dispatch({
        changes: { from, to, insert: `${marker}${selText}${marker}` },
        selection: { anchor: from + mLen, head: to + mLen },
      });
    }
    return true;
  }

  // 无选中：插入标记对，光标居中
  view.dispatch({
    changes: { from, insert: `${marker}${marker}` },
    selection: { anchor: from + mLen },
  });
  return true;
}

const markdownKeymap = keymap.of([
  { key: 'Mod-b', run: (v) => toggleMarkdownMark(v, '**') },
  { key: 'Mod-i', run: (v) => toggleMarkdownMark(v, '*') },
  { key: 'Mod-`', run: (v) => toggleMarkdownMark(v, '`') },
]);

export const CodeMirrorEditor = forwardRef<CodeMirrorEditorHandle, CodeMirrorEditorProps>(
  function CodeMirrorEditor(
    { content, onChange, placeholder, basePath, onPasteFiles, onDropFiles },
    ref,
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<EditorView | null>(null);
    const onChangeRef = useRef(onChange);
    const onPasteFilesRef = useRef(onPasteFiles);
    const onDropFilesRef = useRef(onDropFiles);
    const [previewSrc, setPreviewSrc] = useState<string | null>(null);

    useEffect(() => {
      onChangeRef.current = onChange;
    }, [onChange]);

    useEffect(() => {
      onPasteFilesRef.current = onPasteFiles;
    }, [onPasteFiles]);

    useEffect(() => {
      onDropFilesRef.current = onDropFiles;
    }, [onDropFiles]);

    const basePathRef = useRef(basePath);
    useEffect(() => { basePathRef.current = basePath; }, [basePath]);

    useEffect(() => {
      const view = viewRef.current;
      if (!view || !basePath) return;
      view.dispatch({ effects: forceImageRefresh.of(null) });
    }, [basePath]);

    const resolveUrl = useCallback(
      (fileName: string): string => {
        const currentBasePath = basePathRef.current;
        if (!currentBasePath) return fileName;
        const normalizedBase = currentBasePath.replace(/\\/g, '/');
        const normalizedName = fileName.replace('attachment/', '');
        return `local:///${normalizedBase}/${normalizedName}`;
      },
      [],
    );

    useImperativeHandle(
      ref,
      () => ({
        insertAtCursor: (text: string) => {
          const view = viewRef.current;
          if (!view) return;
          const { from } = view.state.selection.main;
          view.dispatch({
            changes: { from, insert: text },
            selection: { anchor: from + text.length },
          });
          view.focus();
        },
      }),
      [],
    );

    // 设置图片相关回调
    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      // 先设置回调（viewRef 在下面创建）
      setUpdateImageWidthCallback((from: number, to: number, newWidth: number) => {
        const view = viewRef.current;
        if (!view) return;

        const text = view.state.sliceDoc(from, to);
        const parsed = parseImageMarkdown(text, from);
        if (!parsed) return;

        const newMarkdown = buildImageMarkdown(parsed.alt, parsed.src, newWidth);
        view.dispatch({
          changes: { from, to, insert: newMarkdown },
        });
      });

      setMoveToImageCallback((from: number, to: number) => {
        const view = viewRef.current;
        if (!view) return;
        view.dispatch({
          selection: { anchor: to },
        });
        view.focus();
      });

      const extensions = [
        EditorView.lineWrapping,
        lineNumbers(),
        highlightActiveLine(),
        drawSelection(),
        history(),
        markdownKeymap,
        keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap, indentWithTab]),
        markdown({ base: markdownLanguage }),
        cmPlaceholder(placeholder || ''),
        livePreviewPlugin(resolveUrl),
        livePreviewSyntaxHighlighting(),
        attachmentUrlPlugin(resolveUrl),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChangeRef.current(update.state.doc.toString());
          }
        }),
        EditorView.domEventHandlers({
          click: (event, view) => {
            const target = event.target as HTMLElement;
            // 如果点击的是图片容器内的元素，不处理预览
            if (target.closest('.cm-image-container')) {
              return false;
            }
            if (target.tagName === 'IMG') {
              const src = (target as HTMLImageElement).src;
              if (src && !src.startsWith('attachment/')) {
                setPreviewSrc(src);
              }
            }
            return false;
          },
        }),
        editorTheme,
      ];

      const state = EditorState.create({
        doc: content,
        extensions,
      });

      const view = new EditorView({ state, parent: container });
      viewRef.current = view;

      return () => {
        view.destroy();
        viewRef.current = null;
      };
    }, []);

    useEffect(() => {
      const view = viewRef.current;
      if (!view) return;
      if (content !== view.state.doc.toString()) {
        view.dispatch({
          changes: {
            from: 0,
            to: view.state.doc.length,
            insert: content,
          },
        });
      }
    }, [content]);

    const handleDragOver = useCallback((e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    }, []);

    const handleDrop = useCallback(
      async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();

        const dropHandler = onDropFilesRef.current || onPasteFilesRef.current;
        if (!dropHandler) return;

        const files = Array.from(e.dataTransfer.files);
        if (files.length === 0) return;

        try {
          const markdowns = await dropHandler(files);
          const view = viewRef.current;
          if (!view) return;
          const insertText = markdowns.join('\n\n') + '\n\n';
          const { from } = view.state.selection.main;
          view.dispatch({
            changes: { from, insert: insertText },
            selection: { anchor: from + insertText.length },
          });
          view.focus();
        } catch (err) {
          console.error('Failed to handle dropped files:', err);
        }
      },
      [],
    );

    const handlePaste = useCallback(
      async (e: React.ClipboardEvent) => {
        const pasteHandler = onPasteFilesRef.current;
        if (!pasteHandler) return;

        const items = e.clipboardData.items;
        const files: File[] = [];
        for (let i = 0; i < items.length; i++) {
          const item = items[i]!;
          if (item.kind === 'file') {
            const file = item.getAsFile();
            if (file) files.push(file);
          }
        }

        if (files.length === 0) return;

        e.preventDefault();
        e.stopPropagation();

        try {
          const view = viewRef.current;
          if (!view) return;

          const markdowns = await pasteHandler(files);
          const insertText = markdowns.join('\n\n') + '\n\n';

          const { from } = view.state.selection.main;
          view.dispatch({
            changes: { from, insert: insertText },
            selection: { anchor: from + insertText.length },
          });
          view.focus();
        } catch (err) {
          console.error('Failed to paste files:', err);
        }
      },
      [],
    );

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
      </div>
    );
  },
);
