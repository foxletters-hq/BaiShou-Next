import { EditorView, Decoration, DecorationSet, ViewPlugin, ViewUpdate, WidgetType } from '@codemirror/view';
import { syntaxTree } from '@codemirror/language';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import type { SyntaxNodeRef } from '@lezer/common';
import { StateEffect } from '@codemirror/state';
import { parseImageMarkdown, clampWidth, IMAGE_SIZE_CONFIG } from './image-utils';

export const forceImageRefresh = StateEffect.define();

let updateImageWidthCallback: ((from: number, to: number, newWidth: number) => void) | null = null;
let moveToImageCallback: ((from: number, to: number) => void) | null = null;

export function setUpdateImageWidthCallback(callback: (from: number, to: number, newWidth: number) => void) {
  updateImageWidthCallback = callback;
}

export function setMoveToImageCallback(callback: (from: number, to: number) => void) {
  moveToImageCallback = callback;
}

class ImageWidget extends WidgetType {
  private container: HTMLElement | null = null;
  private resizeHandle: HTMLElement | null = null;

  constructor(
    private src: string,
    private alt: string,
    private width?: number,
    private imageFrom?: number,
    private imageTo?: number,
  ) {
    super();
  }

  eq(other: ImageWidget): boolean {
    return this.src === other.src && this.alt === other.alt && this.width === other.width;
  }

  toDOM(): HTMLElement {
    this.container = document.createElement('div');
    this.container.className = 'cm-image-container';
    if (this.width) {
      this.container.style.width = `${this.width}px`;
    }

    const img = document.createElement('img');
    img.src = this.src;
    img.alt = this.alt;
    img.className = 'cm-image-resizable';
    img.draggable = false;
    this.container.appendChild(img);

    this.resizeHandle = document.createElement('div');
    this.resizeHandle.className = 'cm-image-resize-handle';
    this.container.appendChild(this.resizeHandle);

    this.bindEvents(img);

    return this.container;
  }

  private bindEvents(img: HTMLElement) {
    if (!this.container || !this.resizeHandle) return;

    // 点击图片 → 光标跳转到编辑器中的 markdown 文本
    img.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.imageFrom !== undefined && this.imageTo !== undefined && moveToImageCallback) {
        moveToImageCallback(this.imageFrom, this.imageTo);
      }
    });

    // 拖拽缩放
    let startX = 0;
    let startWidth = 0;

    this.resizeHandle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      startX = e.clientX;
      startWidth = this.container!.offsetWidth;

      const onMouseMove = (e: MouseEvent) => {
        const delta = e.clientX - startX;
        const newWidth = clampWidth(startWidth + delta);
        this.container!.style.width = `${newWidth}px`;
      };

      const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        const newWidth = this.container!.offsetWidth;
        if (this.imageFrom !== undefined && this.imageTo !== undefined && updateImageWidthCallback) {
          updateImageWidthCallback(this.imageFrom, this.imageTo, newWidth);
        }
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });

    // 滚轮缩放
    this.container.addEventListener('wheel', (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -IMAGE_SIZE_CONFIG.step : IMAGE_SIZE_CONFIG.step;
        const currentWidth = this.container!.offsetWidth;
        const newWidth = clampWidth(currentWidth + delta);
        this.container!.style.width = `${newWidth}px`;
        if (this.imageFrom !== undefined && this.imageTo !== undefined && updateImageWidthCallback) {
          updateImageWidthCallback(this.imageFrom, this.imageTo, newWidth);
        }
      }
    });
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
        if (!onActiveLine) {
          marks.push(hideMark.range(node.from, node.to));
        }
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
        const from = node.from;
        const to = node.to;
        const cursorInOpen = isCursorInRange(from, from + openLen, cursors);
        const cursorInClose = isCursorInRange(to - closeLen, to, cursors);
        if (!cursorInOpen) marks.push(hideMark.range(from, from + openLen));
        if (!cursorInClose) marks.push(hideMark.range(to - closeLen, to));
        return;
      }

      if (name === 'Emphasis') {
        const text = doc.sliceString(node.from, node.to);
        if (text.length < 3) return;
        const from = node.from;
        const to = node.to;
        const cursorInOpen = isCursorInRange(from, from + 1, cursors);
        const cursorInClose = isCursorInRange(to - 1, to, cursors);
        if (!cursorInOpen) marks.push(hideMark.range(from, from + 1));
        if (!cursorInClose) marks.push(hideMark.range(to - 1, to));
        return;
      }

      if (name === 'Strikethrough') {
        const from = node.from;
        const to = node.to;
        const cursorInOpen = isCursorInRange(from, from + 2, cursors);
        const cursorInClose = isCursorInRange(to - 2, to, cursors);
        if (!cursorInOpen) marks.push(hideMark.range(from, from + 2));
        if (!cursorInClose) marks.push(hideMark.range(to - 2, to));
        return;
      }

      if (name === 'InlineCode') {
        const text = doc.sliceString(node.from, node.to);
        const tickLen = text.startsWith('``') ? 2 : 1;
        const from = node.from;
        const to = node.to;
        const cursorInOpen = isCursorInRange(from, from + tickLen, cursors);
        const cursorInClose = isCursorInRange(to - tickLen, to, cursors);
        if (!cursorInOpen) marks.push(hideMark.range(from, from + tickLen));
        if (!cursorInClose) marks.push(hideMark.range(to - tickLen, to));
        return;
      }

      // 图片渲染
      if (name === 'Image') {
        const text = doc.sliceString(node.from, node.to);
        const parsed = parseImageMarkdown(text, node.from);

        // 光标在图片行时，显示原始 markdown 文本（隐藏 ![]() 标记）
        if (onActiveLine) {
          const bracketOpen = text.indexOf('![');
          const bracketClose = text.indexOf('](');
          if (bracketOpen !== -1) {
            marks.push(hideMark.range(node.from + bracketOpen, node.from + bracketOpen + 2));
          }
          if (bracketClose !== -1) {
            marks.push(hideMark.range(node.from + bracketClose, node.from + bracketClose + 2));
          }
          const closeParen = text.lastIndexOf(')');
          if (closeParen !== -1) {
            marks.push(hideMark.range(node.from + closeParen, node.from + closeParen + 1));
          }
          return;
        }

        // 非活动行，渲染图片 widget
        if (parsed) {
          const src = resolveUrl ? resolveUrl(parsed.src) : parsed.src;
          marks.push({
            from: node.from,
            to: node.to,
            value: Decoration.replace({
              widget: new ImageWidget(src, parsed.alt, parsed.width, node.from, node.to),
            }),
          });
        }
        return;
      }

      // 链接：可能被解析为 Link 的扩展图片语法（含 | 数字）
      if (name === 'Link') {
        const text = doc.sliceString(node.from, node.to);
        const imageWithWidthMatch = text.match(/^!\[([^\]]*)\]\(([^)]+?)(?:\s*\|\s*(\d+))?\)$/);
        if (imageWithWidthMatch) {
          // 光标在图片行时，显示原始文本
          if (onActiveLine) {
            return;
          }

          const alt = imageWithWidthMatch[1] ?? '';
          const rawSrc = imageWithWidthMatch[2] ?? '';
          const widthStr = imageWithWidthMatch[3];
          const width = widthStr ? parseInt(widthStr, 10) : undefined;
          const src = resolveUrl ? resolveUrl(rawSrc) : rawSrc;
          marks.push({
            from: node.from,
            to: node.to,
            value: Decoration.replace({
              widget: new ImageWidget(src, alt, width, node.from, node.to),
            }),
          });
          return;
        }

        const bracketOpen = text.indexOf('[');
        const bracketClose = text.indexOf('](');
        if (bracketOpen !== -1 && bracketClose !== -1) {
          const openFrom = node.from + bracketOpen;
          const closeFrom = node.from + bracketClose;
          const cursorInOpen = isCursorInRange(openFrom, openFrom + 1, cursors);
          const cursorInClose = isCursorInRange(closeFrom, node.to, cursors);
          if (!cursorInOpen) marks.push(hideMark.range(openFrom, openFrom + 1));
          if (!cursorInClose) marks.push(hideMark.range(closeFrom, node.to));
          marks.push(linkMark.range(openFrom + 1, closeFrom));
        }
        return;
      }

      if (onActiveLine) return;

      if (name === 'QuoteMark') {
        marks.push(hideMark.range(node.from, node.to));
        return;
      }

      if (name === 'ListMark') {
        marks.push(hideMark.range(node.from, node.to));
        return;
      }

      if (name === 'TaskMarker') {
        marks.push(hideMark.range(node.from, node.to));
        return;
      }
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
