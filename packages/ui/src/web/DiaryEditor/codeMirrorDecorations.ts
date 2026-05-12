import { EditorView, Decoration, DecorationSet, ViewPlugin, ViewUpdate, WidgetType } from '@codemirror/view';
import { syntaxTree } from '@codemirror/language';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import type { SyntaxNodeRef } from '@lezer/common';
import { StateEffect } from '@codemirror/state';
import { parseImageMarkdown, clampWidth, IMAGE_SIZE_CONFIG, buildImageMarkdown } from './image-utils';

export const forceImageRefresh = StateEffect.define();

let updateImageMarkdownCallback: ((from: number, to: number, newMarkdown: string) => void) | null = null;
let moveToImageCallback: ((from: number, to: number) => void) | null = null;

export function setUpdateImageMarkdownCallback(callback: (from: number, to: number, newMarkdown: string) => void) {
  updateImageMarkdownCallback = callback;
}

export function setMoveToImageCallback(callback: (from: number, to: number) => void) {
  moveToImageCallback = callback;
}

class ImageWidget extends WidgetType {
  private elm: HTMLElement | null = null;
  private wrapper: HTMLElement | null = null;
  private handle: HTMLElement | null = null;
  private linkRow: HTMLElement | null = null;

  constructor(
    private resolvedSrc: string,
    private rawSrc: string,
    private alt: string,
    private width?: number,
    private imageFrom?: number,
    private imageTo?: number,
    private markdownText?: string,
    private showLinkRow: boolean = false,
  ) {
    super();
  }

  eq(other: ImageWidget): boolean {
    return this.resolvedSrc === other.resolvedSrc
      && this.rawSrc === other.rawSrc
      && this.alt === other.alt
      && this.width === other.width
      && this.showLinkRow === other.showLinkRow
      && this.markdownText === other.markdownText;
  }

  toDOM(): HTMLElement {
    this.elm = document.createElement('div');
    this.elm.className = 'cm-image-container';

    // 链接文本行：光标在位时显示
    this.linkRow = document.createElement('div');
    this.linkRow.className = 'cm-image-link-row';
    this.linkRow.contentEditable = 'true';
    this.linkRow.spellcheck = false;
    this.linkRow.textContent = this.markdownText || '';
    if (!this.showLinkRow) {
      this.linkRow.style.display = 'none';
    }

    this.linkRow.addEventListener('mousedown', (e) => e.stopPropagation());
    this.linkRow.addEventListener('click', (e) => e.stopPropagation());
    this.linkRow.addEventListener('keydown', (e) => e.stopPropagation());

    // 实时同步
    this.linkRow.addEventListener('input', () => {
      if (this.imageFrom !== undefined && this.imageTo !== undefined && updateImageMarkdownCallback) {
        updateImageMarkdownCallback(this.imageFrom, this.imageTo, this.linkRow!.textContent || '');
      }
    });

    this.elm.appendChild(this.linkRow);

    // 图片
    this.wrapper = document.createElement('div');
    this.wrapper.className = 'cm-image-wrapper';
    if (this.width && this.width > 0) {
      this.wrapper.style.width = `${this.width}px`;
    }

    const img = document.createElement('img');
    img.src = this.resolvedSrc;
    img.alt = this.alt;
    img.className = 'cm-image-resizable';
    img.draggable = false;
    this.wrapper.appendChild(img);

    this.handle = document.createElement('div');
    this.handle.className = 'cm-image-resize-handle';
    this.wrapper.appendChild(this.handle);

    this.elm.appendChild(this.wrapper);

    // 图片点击 → 光标跳转到该行
    img.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.imageFrom !== undefined && this.imageTo !== undefined && moveToImageCallback) {
        moveToImageCallback(this.imageFrom, this.imageTo);
      }
    });

    this.setupResize();

    return this.elm;
  }

  private setupResize() {
    if (!this.wrapper || !this.handle) return;

    let sx = 0, sw = 0;
    this.handle.addEventListener('mousedown', (e) => {
      e.preventDefault(); e.stopPropagation();
      sx = e.clientX; sw = this.wrapper!.offsetWidth;
      const mv = (e: MouseEvent) => {
        this.wrapper!.style.width = `${clampWidth(sw + e.clientX - sx)}px`;
      };
      const up = () => {
        document.removeEventListener('mousemove', mv);
        document.removeEventListener('mouseup', up);
        this.commitWidth();
      };
      document.addEventListener('mousemove', mv);
      document.addEventListener('mouseup', up);
    });

    // Alt + 滚轮缩放
    this.wrapper.addEventListener('wheel', (e) => {
      if (e.altKey) {
        e.preventDefault();
        const d = e.deltaY > 0 ? -IMAGE_SIZE_CONFIG.step : IMAGE_SIZE_CONFIG.step;
        this.wrapper!.style.width = `${clampWidth(this.wrapper!.offsetWidth + d)}px`;
        this.commitWidth();
      }
    });
  }

  private commitWidth() {
    if (!this.wrapper || this.imageFrom === undefined || this.imageTo === undefined) return;
    const w = this.wrapper.offsetWidth;
    // 使用原始 src 构建 markdown
    const newText = buildImageMarkdown(this.alt, this.rawSrc, w);
    if (updateImageMarkdownCallback) {
      updateImageMarkdownCallback(this.imageFrom, this.imageTo, newText);
    }
  }

  ignoreEvent(): boolean {
    return false;
  }
}

function getCursorPositions(view: EditorView): number[] {
  return view.state.selection.ranges.map((r) => r.head);
}

function isCursorInRange(from: number, to: number, cursors: number[]): boolean {
  return cursors.some((c) => c >= from && c <= to);
}

function isCursorOnLine(lineFrom: number, lineTo: number, cursors: number[]): boolean {
  return cursors.some((c) => c >= lineFrom && c <= lineTo);
}

const hideMark = Decoration.replace({});

const headingStyles: Record<number, Decoration> = {
  1: Decoration.mark({ class: 'cm-rendered-h1' }),
  2: Decoration.mark({ class: 'cm-rendered-h2' }),
  3: Decoration.mark({ class: 'cm-rendered-h3' }),
  4: Decoration.mark({ class: 'cm-rendered-h4' }),
  5: Decoration.mark({ class: 'cm-rendered-h5' }),
  6: Decoration.mark({ class: 'cm-rendered-h6' }),
};

const codeBlockMark = Decoration.mark({ class: 'cm-rendered-codeBlock' });
const codeMarkStyle = Decoration.mark({ class: 'cm-rendered-codeMark' });
const linkMark = Decoration.mark({ class: 'cm-rendered-link' });

const livePreviewHighlight = HighlightStyle.define([
  { tag: tags.strong, fontWeight: '700' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.strikethrough, textDecoration: 'line-through', color: 'var(--text-tertiary)' },
  { tag: tags.monospace, fontFamily: "'Fira Code', 'Courier New', monospace", backgroundColor: 'var(--bg-surface-normal)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.9em' },
]);

export function livePreviewSyntaxHighlighting() {
  return syntaxHighlighting(livePreviewHighlight);
}

function isImageMarkdown(text: string): RegExpMatchArray | null {
  return text.match(/^!\[([^\]]*)\]\(([^)]+?)(?:\s*\|\s*(\d+))?\)$/);
}

function tryBuildImageWidget(
  text: string,
  nodeFrom: number,
  nodeTo: number,
  onActiveLine: boolean,
  resolveUrl?: (url: string) => string,
): { from: number; to: number; value: Decoration } | null {
  const m = isImageMarkdown(text);
  if (!m) return null;
  const alt = m[1] ?? '';
  const rawSrc = (m[2] ?? '').trim();
  const w = m[3] ? parseInt(m[3], 10) : undefined;
  const resolvedSrc = resolveUrl ? resolveUrl(rawSrc) : rawSrc;
  return {
    from: nodeFrom,
    to: nodeTo,
    value: Decoration.replace({
      widget: new ImageWidget(resolvedSrc, rawSrc, alt, w, nodeFrom, nodeTo, text, onActiveLine),
    }),
  };
}

function buildMarkerHidingDecorations(
  view: EditorView,
  resolveUrl?: (url: string) => string,
): DecorationSet {
  const cursors = getCursorPositions(view);
  const marks: { from: number; to: number; value: Decoration }[] = [];
  const tree = syntaxTree(view.state);
  const doc = view.state.doc;

  tree.iterate({
    enter(node: SyntaxNodeRef) {
      const line = doc.lineAt(node.from);
      const onActiveLine = isCursorOnLine(line.from, line.to, cursors);
      const name = node.type.name;

      if (name === 'FencedCode') {
        marks.push(codeBlockMark.range(node.from, node.to));
        return false;
      }

      if (name === 'CodeMark') {
        const parent = node.node.parent;
        if (parent && parent.type.name === 'FencedCode') {
          marks.push(codeMarkStyle.range(node.from, node.to));
          return;
        }
        if (!onActiveLine) marks.push(hideMark.range(node.from, node.to));
        return;
      }

      if (name.startsWith('ATXHeading')) {
        const text = doc.sliceString(node.from, node.to);
        const match = text.match(/^(#{1,6})\s?/);
        if (match) {
          const prefixEnd = node.from + match[0].length;
          const cursorInMarker = isCursorInRange(node.from, prefixEnd, cursors);
          if (!onActiveLine || !cursorInMarker) {
            marks.push(hideMark.range(node.from, prefixEnd));
          }
          const level = match[1]!.length;
          marks.push(headingStyles[level]!.range(cursorInMarker ? node.from : prefixEnd, node.to));
        }
        return;
      }

      if (name === 'StrongEmphasis') {
        const text = doc.sliceString(node.from, node.to);
        const openLen = text.startsWith('**') || text.startsWith('__') ? 2 : 1;
        const closeLen = text.endsWith('**') || text.endsWith('__') ? 2 : 1;
        const f = node.from, t = node.to;
        if (!isCursorInRange(f, f + openLen, cursors)) marks.push(hideMark.range(f, f + openLen));
        if (!isCursorInRange(t - closeLen, t, cursors)) marks.push(hideMark.range(t - closeLen, t));
        return;
      }

      if (name === 'Emphasis') {
        const text = doc.sliceString(node.from, node.to);
        if (text.length < 3) return;
        const f = node.from, t = node.to;
        if (!isCursorInRange(f, f + 1, cursors)) marks.push(hideMark.range(f, f + 1));
        if (!isCursorInRange(t - 1, t, cursors)) marks.push(hideMark.range(t - 1, t));
        return;
      }

      if (name === 'Strikethrough') {
        const f = node.from, t = node.to;
        if (!isCursorInRange(f, f + 2, cursors)) marks.push(hideMark.range(f, f + 2));
        if (!isCursorInRange(t - 2, t, cursors)) marks.push(hideMark.range(t - 2, t));
        return;
      }

      if (name === 'InlineCode') {
        const text = doc.sliceString(node.from, node.to);
        const tickLen = text.startsWith('``') ? 2 : 1;
        const f = node.from, t = node.to;
        if (!isCursorInRange(f, f + tickLen, cursors)) marks.push(hideMark.range(f, f + tickLen));
        if (!isCursorInRange(t - tickLen, t, cursors)) marks.push(hideMark.range(t - tickLen, t));
        return;
      }

      // Image 节点
      if (name === 'Image') {
        const text = doc.sliceString(node.from, node.to);
        const item = tryBuildImageWidget(text, node.from, node.to, onActiveLine, resolveUrl);
        if (item) marks.push(item);
        return;
      }

      // Link 节点 → 可能是扩展图片语法
      if (name === 'Link') {
        const text = doc.sliceString(node.from, node.to);
        const item = tryBuildImageWidget(text, node.from, node.to, onActiveLine, resolveUrl);
        if (item) { marks.push(item); return; }

        const bracketOpen = text.indexOf('[');
        const bracketClose = text.indexOf('](');
        if (bracketOpen !== -1 && bracketClose !== -1) {
          const openFrom = node.from + bracketOpen;
          const closeFrom = node.from + bracketClose;
          if (!isCursorInRange(openFrom, openFrom + 1, cursors)) marks.push(hideMark.range(openFrom, openFrom + 1));
          if (!isCursorInRange(closeFrom, node.to, cursors)) marks.push(hideMark.range(closeFrom, node.to));
          marks.push(linkMark.range(openFrom + 1, closeFrom));
        }
        return;
      }

      // 其他节点：兜底检测图片语法
      if (!onActiveLine) {
        const text = doc.sliceString(node.from, node.to);
        const item = tryBuildImageWidget(text, node.from, node.to, onActiveLine, resolveUrl);
        if (item) { marks.push(item); return; }
      }

      if (onActiveLine) return;

      if (name === 'QuoteMark') { marks.push(hideMark.range(node.from, node.to)); return; }
      if (name === 'ListMark') { marks.push(hideMark.range(node.from, node.to)); return; }
      if (name === 'TaskMarker') { marks.push(hideMark.range(node.from, node.to)); return; }
    },
  });

  return Decoration.set(marks, true);
}

export function livePreviewPlugin(resolveUrl?: (url: string) => string) {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      constructor(view: EditorView) {
        this.decorations = buildMarkerHidingDecorations(view, resolveUrl);
      }
      update(update: ViewUpdate) {
        if (update.docChanged || update.selectionSet ||
            update.transactions.some(t => t.effects.some(e => e.is(forceImageRefresh)))) {
          this.decorations = buildMarkerHidingDecorations(update.view, resolveUrl);
        }
      }
    },
    { decorations: (v) => v.decorations },
  );
}
