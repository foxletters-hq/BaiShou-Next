import { EditorView, Decoration, DecorationSet, ViewPlugin, ViewUpdate, WidgetType } from '@codemirror/view';
import { syntaxTree } from '@codemirror/language';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import type { SyntaxNodeRef } from '@lezer/common';
import { StateEffect } from '@codemirror/state';
import { clampWidth, IMAGE_SIZE_CONFIG } from './image-utils';

export const forceImageRefresh = StateEffect.define();

// 图片宽度存储器：key = position, value = width in px
const imageWidths = new Map<number, number>();

// 回调
let updateImageWidthCallback: ((from: number, to: number, newWidth: number) => void) | null = null;
let moveToImageCallback: ((from: number, to: number) => void) | null = null;

export function setUpdateImageWidthCallback(cb: (from: number, to: number, width: number) => void) {
  updateImageWidthCallback = cb;
}

export function setMoveToImageCallback(cb: (from: number, to: number) => void) {
  moveToImageCallback = cb;
}

// ── Image Widget（仅图片，不含文本）────────────────────────────

class ImageWidget extends WidgetType {
  constructor(
    private src: string,
    private width?: number,
    private pos?: number,
    private posEnd?: number,
  ) { super(); }

  eq(other: ImageWidget) {
    return this.src === other.src && this.width === other.width;
  }

  toDOM() {
    const wrap = document.createElement('div');
    wrap.className = 'cm-image-wrapper';
    if (this.width && this.width > 0) {
      imageWidths.set(this.pos ?? 0, this.width);
      wrap.style.width = `${this.width}px`;
    }

    const img = document.createElement('img');
    img.src = this.src;
    img.className = 'cm-image-resizable';
    img.draggable = false;
    wrap.appendChild(img);

    const handle = document.createElement('div');
    handle.className = 'cm-image-resize-handle';
    wrap.appendChild(handle);

    // 点击 → 跳转光标
    img.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.pos !== undefined && this.posEnd !== undefined && moveToImageCallback) {
        moveToImageCallback(this.pos, this.posEnd);
      }
    });

    this.setupResize(wrap, handle);
    return wrap;
  }

  private setupResize(wrap: HTMLElement, handle: HTMLElement) {
    let sx = 0, sw = 0;
    handle.addEventListener('mousedown', (e) => {
      e.preventDefault(); e.stopPropagation();
      sx = e.clientX; sw = wrap.offsetWidth;
      const mv = (e: MouseEvent) => {
        wrap.style.width = `${clampWidth(sw + e.clientX - sx)}px`;
      };
      const up = () => {
        document.removeEventListener('mousemove', mv);
        document.removeEventListener('mouseup', up);
        const w = wrap.offsetWidth;
        imageWidths.set(this.pos ?? 0, w);
        if (this.pos !== undefined && updateImageWidthCallback) {
          updateImageWidthCallback(this.pos, this.pos, w);
        }
      };
      document.addEventListener('mousemove', mv);
      document.addEventListener('mouseup', up);
    });

    wrap.addEventListener('wheel', (e) => {
      if (e.altKey) {
        e.preventDefault();
        const d = e.deltaY > 0 ? -IMAGE_SIZE_CONFIG.step : IMAGE_SIZE_CONFIG.step;
        wrap.style.width = `${clampWidth(wrap.offsetWidth + d)}px`;
        const w = wrap.offsetWidth;
        imageWidths.set(this.pos ?? 0, w);
        if (this.pos !== undefined && updateImageWidthCallback) {
          updateImageWidthCallback(this.pos, this.pos, w);
        }
      }
    });
  }

  ignoreEvent() { return false; }
}

// ── 工具函数 ────────────────────────────────────────────────────

function getCursorPositions(view: EditorView): number[] {
  return view.state.selection.ranges.map(r => r.head);
}

function isCursorInRange(from: number, to: number, cursors: number[]): boolean {
  return cursors.some(c => c >= from && c <= to);
}

function isCursorOnLine(lineFrom: number, lineTo: number, cursors: number[]): boolean {
  return cursors.some(c => c >= lineFrom && c <= lineTo);
}

function parseImageText(text: string): { alt: string; src: string } | null {
  const m = text.match(/!\[([^\]]*)\]\(([^)]+)\)/);
  if (!m) return null;
  return { alt: m[1] ?? '', src: (m[2] ?? '').trim() };
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

// ── 构建 decorations ───────────────────────────────────────────

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
        if (parent?.type.name === 'FencedCode') {
          marks.push(codeMarkStyle.range(node.from, node.to));
          return;
        }
        if (!onActiveLine) marks.push(hideMark.range(node.from, node.to));
        return;
      }

      if (name.startsWith('ATXHeading')) {
        const text = doc.sliceString(node.from, node.to);
        const m = text.match(/^(#{1,6})\s?/);
        if (m) {
          const prefixEnd = node.from + m[0].length;
          const cim = isCursorInRange(node.from, prefixEnd, cursors);
          if (!onActiveLine || !cim) marks.push(hideMark.range(node.from, prefixEnd));
          marks.push(headingStyles[m[1]!.length]!.range(cim ? node.from : prefixEnd, node.to));
        }
        return;
      }

      if (name === 'StrongEmphasis') {
        const text = doc.sliceString(node.from, node.to);
        const ol = text.startsWith('**') || text.startsWith('__') ? 2 : 1;
        const cl = text.endsWith('**') || text.endsWith('__') ? 2 : 1;
        if (!isCursorInRange(node.from, node.from + ol, cursors)) marks.push(hideMark.range(node.from, node.from + ol));
        if (!isCursorInRange(node.to - cl, node.to, cursors)) marks.push(hideMark.range(node.to - cl, node.to));
        return;
      }

      if (name === 'Emphasis') {
        const text = doc.sliceString(node.from, node.to);
        if (text.length < 3) return;
        if (!isCursorInRange(node.from, node.from + 1, cursors)) marks.push(hideMark.range(node.from, node.from + 1));
        if (!isCursorInRange(node.to - 1, node.to, cursors)) marks.push(hideMark.range(node.to - 1, node.to));
        return;
      }

      if (name === 'Strikethrough') {
        if (!isCursorInRange(node.from, node.from + 2, cursors)) marks.push(hideMark.range(node.from, node.from + 2));
        if (!isCursorInRange(node.to - 2, node.to, cursors)) marks.push(hideMark.range(node.to - 2, node.to));
        return;
      }

      if (name === 'InlineCode') {
        const text = doc.sliceString(node.from, node.to);
        const tl = text.startsWith('``') ? 2 : 1;
        if (!isCursorInRange(node.from, node.from + tl, cursors)) marks.push(hideMark.range(node.from, node.from + tl));
        if (!isCursorInRange(node.to - tl, node.to, cursors)) marks.push(hideMark.range(node.to - tl, node.to));
        return;
      }

      // ── 图片处理 ──
      if (name === 'Image') {
        const text = doc.sliceString(node.from, node.to);
        const parsed = parseImageText(text);
        if (!parsed) return;

        const src = resolveUrl ? resolveUrl(parsed.src) : parsed.src;

        if (onActiveLine) {
          // 光标在图片行：隐藏 ![]() 标记，保留文本供编辑
          const bo = text.indexOf('![');
          const bc = text.indexOf('](');
          const cp = text.lastIndexOf(')');
          if (bo !== -1) marks.push(hideMark.range(node.from + bo, node.from + bo + 2));
          if (bc !== -1) marks.push(hideMark.range(node.from + bc, node.from + bc + 2));
          if (cp !== -1) marks.push(hideMark.range(node.from + cp, node.from + cp + 1));
          // 同时显示图片
          const w = imageWidths.get(node.from);
          marks.push({
            from: node.from,
            to: node.from,
            value: Decoration.widget({
              widget: new ImageWidget(src, w, node.from, node.to),
              side: -1,
            }),
          });
        } else {
          // 光标不在图片行：只显示图片
          const w = imageWidths.get(node.from);
          marks.push({
            from: node.from,
            to: node.to,
            value: Decoration.replace({
              widget: new ImageWidget(src, w, node.from, node.to),
            }),
          });
        }
        return;
      }

      // Link → 可能是含 | 数字的图片语法（清理遗留兼容）
      if (name === 'Link') {
        const text = doc.sliceString(node.from, node.to);
        // 如果文本以 ![ 开头，尝试作为图片渲染
        if (text.startsWith('![')) {
          const parsed = parseImageText(text);
          if (parsed) {
            const src = resolveUrl ? resolveUrl(parsed.src) : parsed.src;
            marks.push({
              from: node.from,
              to: node.to,
              value: Decoration.replace({
                widget: new ImageWidget(src, undefined, node.from, node.to),
              }),
            });
            return;
          }
        }

        const bo = text.indexOf('[');
        const bc = text.indexOf('](');
        if (bo !== -1 && bc !== -1) {
          const of = node.from + bo;
          const cf = node.from + bc;
          if (!isCursorInRange(of, of + 1, cursors)) marks.push(hideMark.range(of, of + 1));
          if (!isCursorInRange(cf, node.to, cursors)) marks.push(hideMark.range(cf, node.to));
          marks.push(linkMark.range(of + 1, cf));
        }
        return;
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
    { decorations: v => v.decorations },
  );
}
