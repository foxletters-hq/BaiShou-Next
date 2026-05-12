import { EditorView, Decoration, DecorationSet, ViewPlugin, ViewUpdate, WidgetType } from '@codemirror/view';
import { syntaxTree } from '@codemirror/language';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import type { SyntaxNodeRef } from '@lezer/common';
import { StateEffect } from '@codemirror/state';
import { clampWidth, IMAGE_SIZE_CONFIG } from './image-utils';

export const forceImageRefresh = StateEffect.define();

let updateImageTitleCallback: ((from: number, to: number, newTitle: string) => void) | null = null;
let moveToImageCallback: ((from: number, to: number) => void) | null = null;

export function setUpdateImageTitleCallback(cb: (from: number, to: number, title: string) => void) {
  updateImageTitleCallback = cb;
}
export function setMoveToImageCallback(cb: (from: number, to: number) => void) {
  moveToImageCallback = cb;
}

// ── 解析：alt、src、title（宽度存在 title 中） ────────────────

function parseImage(text: string): { alt: string; src: string; title: string } | null {
  const m = text.match(/^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)$/);
  if (!m) return null;
  return { alt: m[1] ?? '', src: m[2] ?? '', title: m[3] ?? '' };
}

function buildImage(alt: string, src: string, width?: number): string {
  if (width && width > 0) return `![${alt}](${src} "${width}")`;
  return `![${alt}](${src})`;
}

// ── Image Widget ───────────────────────────────────────────────

class ImageWidget extends WidgetType {
  private wrap: HTMLElement | null = null;

  constructor(
    private src: string,
    private rawSrc: string,
    private alt: string,
    private width?: number,
    private pos?: number,
    private posEnd?: number,
    private showText: boolean = false,
    private fullText?: string,
  ) { super(); }

  eq(other: ImageWidget) {
    return this.src === other.src && this.width === other.width && this.showText === other.showText;
  }

  toDOM(): HTMLElement {
    const root = document.createElement('div');
    root.className = 'cm-image-container';

    // 链接文本行（图片上方，点击后显示）
    if (this.showText && this.fullText) {
      const textRow = document.createElement('div');
      textRow.className = 'cm-image-text-row';
      textRow.textContent = this.fullText;
      root.appendChild(textRow);
    }

    // 图片
    this.wrap = document.createElement('div');
    this.wrap.className = 'cm-image-wrapper';
    if (this.width && this.width > 0) {
      this.wrap.style.width = `${this.width}px`;
    }

    const img = document.createElement('img');
    img.src = this.src;
    img.alt = this.alt;
    img.className = 'cm-image-resizable';
    img.draggable = false;
    this.wrap.appendChild(img);

    const handle = document.createElement('div');
    handle.className = 'cm-image-resize-handle';
    this.wrap.appendChild(handle);

    root.appendChild(this.wrap);

    // 点击图片 → 光标跳转
    img.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.pos !== undefined && this.posEnd !== undefined && moveToImageCallback) {
        moveToImageCallback(this.pos, this.posEnd);
      }
    });

    this.setupResize(handle);
    return root;
  }

  private setupResize(handle: HTMLElement) {
    let sx = 0, sw = 0;
    handle.addEventListener('mousedown', (e) => {
      e.preventDefault(); e.stopPropagation();
      if (!this.wrap) return;
      sx = e.clientX; sw = this.wrap.offsetWidth;
      const mv = (e: MouseEvent) => {
        this.wrap!.style.width = `${clampWidth(sw + e.clientX - sx)}px`;
      };
      const up = () => {
        document.removeEventListener('mousemove', mv);
        document.removeEventListener('mouseup', up);
        const w = this.wrap!.offsetWidth;
        if (this.pos !== undefined && updateImageTitleCallback) {
          updateImageTitleCallback(this.pos, this.pos, `${w}`);
        }
      };
      document.addEventListener('mousemove', mv);
      document.addEventListener('mouseup', up);
    });

    if (!this.wrap) return;
    this.wrap.addEventListener('wheel', (e) => {
      if (e.altKey) {
        e.preventDefault();
        const d = e.deltaY > 0 ? -IMAGE_SIZE_CONFIG.step : IMAGE_SIZE_CONFIG.step;
        this.wrap!.style.width = `${clampWidth(this.wrap!.offsetWidth + d)}px`;
        const w = this.wrap!.offsetWidth;
        if (this.pos !== undefined && updateImageTitleCallback) {
          updateImageTitleCallback(this.pos, this.pos, `${w}`);
        }
      }
    });
  }

  ignoreEvent() { return false; }
}

// ── 工具 ───────────────────────────────────────────────────────

function getCursorPositions(view: EditorView): number[] {
  return view.state.selection.ranges.map(r => r.head);
}
function isCursorInRange(from: number, to: number, cursors: number[]): boolean {
  return cursors.some(c => c >= from && c <= to);
}
function isCursorOnLine(lineFrom: number, lineTo: number, cursors: number[]): boolean {
  return cursors.some(c => c >= lineFrom && c <= lineTo);
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

// ── Decorations ───────────────────────────────────────────────

function buildDecorations(view: EditorView, resolveUrl?: (s: string) => string): DecorationSet {
  const cursors = getCursorPositions(view);
  const marks: { from: number; to: number; value: Decoration }[] = [];
  const tree = syntaxTree(view.state);
  const doc = view.state.doc;

  tree.iterate({
    enter(node: SyntaxNodeRef) {
      const line = doc.lineAt(node.from);
      const onActiveLine = isCursorOnLine(line.from, line.to, cursors);
      const name = node.type.name;

      // ── 标准节点处理 ──
      if (name === 'FencedCode') { marks.push(codeBlockMark.range(node.from, node.to)); return false; }
      if (name === 'CodeMark') { if (node.node.parent?.type.name === 'FencedCode') marks.push(codeMarkStyle.range(node.from, node.to)); else if (!onActiveLine) marks.push(hideMark.range(node.from, node.to)); return; }
      if (name.startsWith('ATXHeading')) { const t = doc.sliceString(node.from, node.to); const m = t.match(/^(#{1,6})\s?/); if (m) { const pe = node.from + m[0].length; const ci = isCursorInRange(node.from, pe, cursors); if (!onActiveLine || !ci) marks.push(hideMark.range(node.from, pe)); marks.push(headingStyles[m[1]!.length]!.range(ci ? node.from : pe, node.to)); } return; }
      if (name === 'StrongEmphasis') { const t = doc.sliceString(node.from, node.to); const ol = t.startsWith('**') || t.startsWith('__') ? 2 : 1; const cl = t.endsWith('**') || t.endsWith('__') ? 2 : 1; if (!isCursorInRange(node.from, node.from + ol, cursors)) marks.push(hideMark.range(node.from, node.from + ol)); if (!isCursorInRange(node.to - cl, node.to, cursors)) marks.push(hideMark.range(node.to - cl, node.to)); return; }
      if (name === 'Emphasis') { const t = doc.sliceString(node.from, node.to); if (t.length < 3) return; if (!isCursorInRange(node.from, node.from + 1, cursors)) marks.push(hideMark.range(node.from, node.from + 1)); if (!isCursorInRange(node.to - 1, node.to, cursors)) marks.push(hideMark.range(node.to - 1, node.to)); return; }
      if (name === 'Strikethrough') { if (!isCursorInRange(node.from, node.from + 2, cursors)) marks.push(hideMark.range(node.from, node.from + 2)); if (!isCursorInRange(node.to - 2, node.to, cursors)) marks.push(hideMark.range(node.to - 2, node.to)); return; }
      if (name === 'InlineCode') { const t = doc.sliceString(node.from, node.to); const tl = t.startsWith('``') ? 2 : 1; if (!isCursorInRange(node.from, node.from + tl, cursors)) marks.push(hideMark.range(node.from, node.from + tl)); if (!isCursorInRange(node.to - tl, node.to, cursors)) marks.push(hideMark.range(node.to - tl, node.to)); return; }

      // ── 图片 ──
      if (name === 'Image') {
        const text = doc.sliceString(node.from, node.to);
        // 确保不跨行（避免 replace 换行报错）
        if (text.includes('\n')) return;

        const parsed = parseImage(text);
        if (!parsed) return;

        const src = resolveUrl ? resolveUrl(parsed.src) : parsed.src;
        const width = parsed.title ? parseInt(parsed.title, 10) || undefined : undefined;

        if (onActiveLine) {
          // 光标在位：隐藏 ![]() 标记 + 显示图片（带文本行）
          const bo = text.indexOf('![');
          const bc = text.indexOf('](');
          const tq = text.indexOf(' "');
          const cp = text.lastIndexOf(')');
          if (bo !== -1) marks.push(hideMark.range(node.from + bo, node.from + bo + 2));
          if (bc !== -1) {
            const end = tq !== -1 ? tq : cp;
            marks.push(hideMark.range(node.from + bc, node.from + end));
          }
          if (tq !== -1 && cp !== -1) marks.push(hideMark.range(node.from + tq, node.from + cp));
          if (tq === -1 && cp !== -1 && bc !== -1) marks.push(hideMark.range(node.from + cp, node.from + cp + 1));

          marks.push({
            from: node.from,
            to: node.from,
            value: Decoration.widget({
              widget: new ImageWidget(src, parsed.src, parsed.alt, width, node.from, node.to, true, text),
              side: -1,
            }),
          });
        } else {
          // 光标不在位：只显示图片
          marks.push({
            from: node.from,
            to: node.to,
            value: Decoration.replace({
              widget: new ImageWidget(src, parsed.src, parsed.alt, width, node.from, node.to),
            }),
          });
        }
        return;
      }

      // Link 节点（可能包含图片语法）
      if (name === 'Link') {
        const text = doc.sliceString(node.from, node.to);
        if (text.startsWith('![') && !text.includes('\n')) {
          const parsed = parseImage(text);
          if (parsed) {
            const src = resolveUrl ? resolveUrl(parsed.src) : parsed.src;
            const width = parsed.title ? parseInt(parsed.title, 10) || undefined : undefined;
            marks.push({ from: node.from, to: node.to, value: Decoration.replace({ widget: new ImageWidget(src, parsed.src, parsed.alt, width, node.from, node.to) }) });
            return;
          }
        }
        const bo = text.indexOf('['), bc = text.indexOf('](');
        if (bo !== -1 && bc !== -1) {
          const of = node.from + bo, cf = node.from + bc;
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

export function livePreviewPlugin(resolveUrl?: (s: string) => string) {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      constructor(view: EditorView) { this.decorations = buildDecorations(view, resolveUrl); }
      update(update: ViewUpdate) {
        if (update.docChanged || update.selectionSet ||
            update.transactions.some(t => t.effects.some(e => e.is(forceImageRefresh)))) {
          this.decorations = buildDecorations(update.view, resolveUrl);
        }
      }
    },
    { decorations: v => v.decorations },
  );
}
