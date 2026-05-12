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
  private linkInput: HTMLInputElement | null = null;

  constructor(
    private src: string,
    private alt: string,
    private width?: number,
    private imageFrom?: number,
    private imageTo?: number,
    private markdownText?: string,
  ) {
    super();
  }

  eq(other: ImageWidget): boolean {
    return this.src === other.src && this.alt === other.alt && this.width === other.width && this.markdownText === other.markdownText;
  }

  toDOM(): HTMLElement {
    this.elm = document.createElement('div');
    this.elm.className = 'cm-image-container';

    // 链接文本行
    const bar = document.createElement('div');
    bar.className = 'cm-image-link-bar';

    this.linkInput = document.createElement('input');
    this.linkInput.type = 'text';
    this.linkInput.className = 'cm-image-link-input';
    this.linkInput.value = this.markdownText || '';
    this.linkInput.spellcheck = false;

    // 阻止冒泡，防止干扰编辑器
    this.linkInput.addEventListener('mousedown', (e) => e.stopPropagation());
    this.linkInput.addEventListener('click', (e) => e.stopPropagation());
    this.linkInput.addEventListener('keydown', (e) => e.stopPropagation());

    // 输入时实时同步到文档
    this.linkInput.addEventListener('input', () => {
      const newText = this.linkInput!.value;
      if (this.imageFrom !== undefined && this.imageTo !== undefined && updateImageMarkdownCallback) {
        updateImageMarkdownCallback(this.imageFrom, this.imageTo, newText);
      }
    });

    bar.appendChild(this.linkInput);
    this.elm.appendChild(bar);

    // 图片包裹
    this.wrapper = document.createElement('div');
    this.wrapper.className = 'cm-image-wrapper';
    if (this.width && this.width > 0) {
      this.wrapper.style.width = `${this.width}px`;
    }

    const img = document.createElement('img');
    img.src = this.src;
    img.alt = this.alt;
    img.className = 'cm-image-resizable';
    img.draggable = false;
    this.wrapper.appendChild(img);

    // 缩放手柄
    this.handle = document.createElement('div');
    this.handle.className = 'cm-image-resize-handle';
    this.wrapper.appendChild(this.handle);

    this.elm.appendChild(this.wrapper);

    // 图片点击 → 光标跳转
    img.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.imageFrom !== undefined && this.imageTo !== undefined && moveToImageCallback) {
        moveToImageCallback(this.imageFrom, this.imageTo);
      }
    });

    // 拖拽缩放
    this.setupResize(img);

    return this.elm;
  }

  private setupResize(img: HTMLElement) {
    if (!this.wrapper || !this.handle) return;

    let startX = 0;
    let startW = 0;

    this.handle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      startX = e.clientX;
      startW = this.wrapper!.offsetWidth;

      const move = (e: MouseEvent) => {
        this.wrapper!.style.width = `${clampWidth(startW + e.clientX - startX)}px`;
      };

      const up = () => {
        document.removeEventListener('mousemove', move);
        document.removeEventListener('mouseup', up);
        this.commitWidth();
      };

      document.addEventListener('mousemove', move);
      document.addEventListener('mouseup', up);
    });

    // Alt + 滚轮缩放
    this.wrapper.addEventListener('wheel', (e) => {
      if (e.altKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -IMAGE_SIZE_CONFIG.step : IMAGE_SIZE_CONFIG.step;
        this.wrapper!.style.width = `${clampWidth(this.wrapper!.offsetWidth + delta)}px`;
        this.commitWidth();
      }
    });
  }

  private commitWidth() {
    if (!this.wrapper || this.imageFrom === undefined || this.imageTo === undefined) return;
    const w = this.wrapper.offsetWidth;

    // 直接构建新 markdown 并提交
    const newText = buildImageMarkdown(this.alt, this.src, w);
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

// 检查文本是否为图片语法（含 | 数字）
function isImageMarkdown(text: string): RegExpMatchArray | null {
  return text.match(/^!\[([^\]]*)\]\(([^)]+?)(?:\s*\|\s*(\d+))?\)$/);
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
        if (parsed) {
          const src = resolveUrl ? resolveUrl(parsed.src) : parsed.src;
          marks.push({
            from: node.from,
            to: node.to,
            value: Decoration.replace({
              widget: new ImageWidget(src, parsed.alt, parsed.width, node.from, node.to, text),
            }),
          });
        }
        return;
      }

      // 链接 → 可能是扩展图片语法（含 | 数字）
      if (name === 'Link') {
        const text = doc.sliceString(node.from, node.to);
        const m = isImageMarkdown(text);
        if (m) {
          const alt = m[1] ?? '';
          const rawSrc = (m[2] ?? '').trim();
          const w = m[3] ? parseInt(m[3], 10) : undefined;
          const src = resolveUrl ? resolveUrl(rawSrc) : rawSrc;
          marks.push({
            from: node.from,
            to: node.to,
            value: Decoration.replace({
              widget: new ImageWidget(src, alt, w, node.from, node.to, text),
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

      // 其他非活动行元素：也检查是否可能是图片语法
      if (!onActiveLine) {
        const text = doc.sliceString(node.from, node.to);
        const m = isImageMarkdown(text);
        if (m) {
          const alt = m[1] ?? '';
          const rawSrc = (m[2] ?? '').trim();
          const w = m[3] ? parseInt(m[3], 10) : undefined;
          const src = resolveUrl ? resolveUrl(rawSrc) : rawSrc;
          marks.push({
            from: node.from,
            to: node.to,
            value: Decoration.replace({
              widget: new ImageWidget(src, alt, w, node.from, node.to, text),
            }),
          });
          return;
        }
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
