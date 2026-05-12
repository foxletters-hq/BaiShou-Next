import { EditorView, Decoration, DecorationSet, ViewPlugin, ViewUpdate, WidgetType } from '@codemirror/view';
import { syntaxTree } from '@codemirror/language';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import type { SyntaxNodeRef } from '@lezer/common';
import type { Extension } from '@codemirror/state';
import { StateEffect } from '@codemirror/state';
import { parseImageMarkdown, clampWidth, IMAGE_SIZE_CONFIG } from './image-utils';

export const forceImageRefresh = StateEffect.define();

// 全局回调函数，用于更新文档中的图片宽度
let updateImageWidthCallback: ((from: number, to: number, newWidth: number) => void) | null = null;

export function setUpdateImageWidthCallback(callback: (from: number, to: number, newWidth: number) => void) {
  updateImageWidthCallback = callback;
}

class ImageWidget extends WidgetType {
  private container: HTMLElement | null = null;
  private resizeHandle: HTMLElement | null = null;
  private linkBar: HTMLElement | null = null;
  private linkInput: HTMLInputElement | null = null;

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
    // 创建容器
    this.container = document.createElement('div');
    this.container.className = 'cm-image-container';
    if (this.width) {
      this.container.style.width = `${this.width}px`;
    }

    // 创建链接栏（默认隐藏）
    this.linkBar = document.createElement('div');
    this.linkBar.className = 'cm-image-link-bar';
    this.linkBar.style.display = 'none';

    this.linkInput = document.createElement('input');
    this.linkInput.type = 'text';
    this.linkInput.className = 'cm-image-link-input';
    this.linkInput.value = this.src;
    this.linkInput.readOnly = true;

    this.linkBar.appendChild(this.linkInput);
    this.container.appendChild(this.linkBar);

    // 创建图片
    const img = document.createElement('img');
    img.src = this.src;
    img.alt = this.alt;
    img.className = 'cm-image-resizable';
    img.draggable = false;
    this.container.appendChild(img);

    // 创建缩放手柄
    this.resizeHandle = document.createElement('div');
    this.resizeHandle.className = 'cm-image-resize-handle';
    this.container.appendChild(this.resizeHandle);

    // 绑定事件
    this.bindEvents(img);

    return this.container;
  }

  private bindEvents(img: HTMLElement) {
    if (!this.container || !this.resizeHandle || !this.linkBar) return;

    // 点击图片显示链接栏
    img.addEventListener('click', (e) => {
      e.stopPropagation();
      this.linkBar!.style.display = 'block';
      this.container!.classList.add('cm-image-active');
    });

    // 点击其他区域隐藏链接栏
    document.addEventListener('click', (e) => {
      if (!this.container!.contains(e.target as Node)) {
        this.linkBar!.style.display = 'none';
        this.container!.classList.remove('cm-image-active');
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
        // 触发文档更新
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
        // 触发文档更新
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

// ── 标记隐藏（Decoration.replace 从 DOM 中移除标记字符，零占位）──

const hideMark = Decoration.replace({});

// ── 块级装饰器（不跨行内元素，安全）───────────────────────────

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

// ── 语法高亮样式（通过 HighlightStyle 注入，不创建额外 DOM 节点）──

const livePreviewHighlight = HighlightStyle.define([
  { tag: tags.strong, fontWeight: '700' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.strikethrough, textDecoration: 'line-through', color: 'var(--text-tertiary)' },
  { tag: tags.monospace, fontFamily: "'Fira Code', 'Courier New', monospace", backgroundColor: 'var(--bg-surface-normal)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.9em' },
]);

export function livePreviewSyntaxHighlighting() {
  return syntaxHighlighting(livePreviewHighlight);
}

// ── 标记隐藏插件 ──────────────────────────────────────────────

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

      // 围栏代码块：跳过子节点
      if (name === 'FencedCode') {
        marks.push(codeBlockMark.range(node.from, node.to));
        return false;
      }

      // 围栏代码块的 ``` 分隔符
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

      // ATX 标题：隐藏 # 前缀，添加标题样式
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

      // 粗体标记 ** __
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

      // 斜体标记 * _
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

      // 删除线标记 ~~
      if (name === 'Strikethrough') {
        const from = node.from;
        const to = node.to;
        const cursorInOpen = isCursorInRange(from, from + 2, cursors);
        const cursorInClose = isCursorInRange(to - 2, to, cursors);
        if (!cursorInOpen) marks.push(hideMark.range(from, from + 2));
        if (!cursorInClose) marks.push(hideMark.range(to - 2, to));
        return;
      }

      // 行内代码标记 `
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

      // 链接：隐藏 [ 和 ](url)
      if (name === 'Link') {
        const text = doc.sliceString(node.from, node.to);
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

      // 图片：活动行显示可编辑的 markdown 文本，非活动行渲染图片预览
      if (name === 'Image') {
        const text = doc.sliceString(node.from, node.to);
        const parsed = parseImageMarkdown(text, node.from);

        if (onActiveLine) {
          const bracketOpen = text.indexOf('![');
          const bracketClose = text.indexOf('](');
          if (bracketOpen !== -1) {
            marks.push(hideMark.range(node.from + bracketOpen, node.from + bracketOpen + 2));
          }
          if (bracketClose !== -1) {
            marks.push(hideMark.range(node.from + bracketClose, node.to));
          }
          return;
        }

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

      // 以下元素仅在非活动行隐藏
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
