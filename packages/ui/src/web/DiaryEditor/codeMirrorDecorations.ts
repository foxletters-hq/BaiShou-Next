import { EditorView, Decoration, DecorationSet, ViewPlugin, ViewUpdate, WidgetType } from '@codemirror/view';
import { syntaxTree } from '@codemirror/language';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import type { SyntaxNodeRef } from '@lezer/common';
import { StateEffect } from '@codemirror/state';
import { clampWidth, IMAGE_SIZE_CONFIG } from './image-utils';

export const forceImageRefresh = StateEffect.define();

let updateDocFromWidget: ((from: number, to: number, text: string) => void) | null = null;
let focusEditor: (() => void) | null = null;

export function setUpdateDocFromWidget(cb: (from: number, to: number, text: string) => void) { updateDocFromWidget = cb; }
export function setFocusEditor(cb: () => void) { focusEditor = cb; }

// ── 解析 / 构建 ───────────────────────────────────────────────

// 匹配 Obsidian 风格: ![alt](src) 或 ![alt](src|475) 或 ![alt](src "475")
function parseImage(text: string): { alt: string; src: string; w?: number } | null {
  let m = text.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
  if (!m) return null;
  const alt = m[1] ?? '';
  const raw = m[2] ?? '';
  // 尝试从 title 提取宽度: src "475"
  let tm = raw.match(/^([^"\s]+)\s+"(\d+)"$/);
  if (tm) return { alt, src: tm[1]!, w: parseInt(tm[2]!, 10) };
  // 尝试从 |数字 提取: src|475
  tm = raw.match(/^(.+?)\s*\|\s*(\d+)$/);
  if (tm) return { alt, src: tm[1]!, w: parseInt(tm[2]!, 10) };
  return { alt, src: raw };
}

function buildImageMd(alt: string, src: string, w?: number): string {
  if (w && w > 0) return `![${alt}](${src}|${w})`;
  return `![${alt}](${src})`;
}

// ── Widget ────────────────────────────────────────────────────

class ImageWidget extends WidgetType {
  private root: HTMLElement | null = null;
  private wrap: HTMLElement | null = null;
  private textRow: HTMLElement | null = null;

  constructor(
    private resolvedSrc: string,
    private rawAlt: string,
    private rawSrc: string,
    private width?: number,
    private nodeFrom?: number,
    private nodeTo?: number,
    private showText: boolean = false,
    // 原始文档文本，用于显示和编辑
    private docText?: string,
  ) { super(); }

  eq(other: ImageWidget) {
    return this.resolvedSrc === other.resolvedSrc && this.width === other.width && this.showText === other.showText;
  }

  toDOM(): HTMLElement {
    this.root = document.createElement('div');
    this.root.className = 'cm-image-root';

    // ── 文本行（图片上方，点击图片后显示）──
    this.textRow = document.createElement('div');
    this.textRow.className = 'cm-image-text-row';

    if (this.showText && this.docText) {
      this.textRow.textContent = this.docText;
      this.textRow.contentEditable = 'true';
      this.textRow.spellcheck = false;

      // 阻止 CodeMirror 捕获键盘事件
      this.textRow.addEventListener('keydown', (e) => {
        e.stopPropagation();
        if (e.key === 'Enter' || e.key === 'Escape') {
          e.preventDefault();
          (e.target as HTMLElement).blur();
        }
      });
      this.textRow.addEventListener('keyup', (e) => e.stopPropagation());
      this.textRow.addEventListener('input', () => {
        if (!updateDocFromWidget || this.nodeFrom == null || this.nodeTo == null) return;
        updateDocFromWidget(this.nodeFrom, this.nodeTo, this.textRow!.textContent || '');
      });
    } else {
      this.textRow.style.display = 'none';
    }

    this.root.appendChild(this.textRow);

    // ── 图片 ──
    this.wrap = document.createElement('div');
    this.wrap.className = 'cm-image-wrapper';
    if (this.width && this.width > 0) this.wrap.style.width = `${this.width}px`;

    const img = document.createElement('img');
    img.src = this.resolvedSrc;
    img.alt = this.rawAlt;
    img.className = 'cm-image-resizable';
    img.draggable = false;
    this.wrap.appendChild(img);

    const h = document.createElement('div');
    h.className = 'cm-image-resize-handle';
    this.wrap.appendChild(h);

    this.root.appendChild(this.wrap);

    // 点击图片 → 触发编辑器显示此行文本
    img.addEventListener('click', (e) => {
      e.stopPropagation();
      focusEditor?.();
      // 通过 forceImageRefresh 触发重绘（此时 onActiveLine=true，showText=true）
      if (updateDocFromWidget && this.nodeFrom != null && this.nodeTo != null) {
        // 先移动光标到行首触发 onActiveLine
        updateDocFromWidget(this.nodeFrom, this.nodeTo, this.docText || '');
      }
    });

    this.setupResize(img, h);
    return this.root;
  }

  private setupResize(_img: HTMLElement, handle: HTMLElement) {
    let sx = 0, sw = 0;
    handle.addEventListener('mousedown', (e1) => {
      e1.preventDefault(); e1.stopPropagation();
      if (!this.wrap) return;
      sx = e1.clientX; sw = this.wrap.offsetWidth;
      const mv = (e2: MouseEvent) => { this.wrap!.style.width = `${clampWidth(sw + e2.clientX - sx)}px`; };
      const up = () => {
        document.removeEventListener('mousemove', mv);
        document.removeEventListener('mouseup', up);
        if (!this.wrap || this.nodeFrom == null || this.nodeTo == null || !updateDocFromWidget) return;
        const w = this.wrap.offsetWidth;
        const newMd = buildImageMd(this.rawAlt, this.rawSrc, w);
        updateDocFromWidget(this.nodeFrom, this.nodeTo, newMd);
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
        if (this.nodeFrom == null || this.nodeTo == null || !updateDocFromWidget) return;
        const w = this.wrap!.offsetWidth;
        const newMd = buildImageMd(this.rawAlt, this.rawSrc, w);
        updateDocFromWidget(this.nodeFrom, this.nodeTo, newMd);
      }
    });
  }

  ignoreEvent() { return false; }
}

// ── 工具 ───────────────────────────────────────────────────────

function cursors(view: EditorView) { return view.state.selection.ranges.map(r => r.head); }
function inRange(f: number, t: number, cs: number[]) { return cs.some(c => c >= f && c <= t); }
function onLine(lf: number, lt: number, cs: number[]) { return cs.some(c => c >= lf && c <= lt); }

const off = Decoration.replace({});
const hl: Record<number, Decoration> = {
  1: Decoration.mark({ class: 'cm-rendered-h1' }), 2: Decoration.mark({ class: 'cm-rendered-h2' }),
  3: Decoration.mark({ class: 'cm-rendered-h3' }), 4: Decoration.mark({ class: 'cm-rendered-h4' }),
  5: Decoration.mark({ class: 'cm-rendered-h5' }), 6: Decoration.mark({ class: 'cm-rendered-h6' }),
};
const cb = Decoration.mark({ class: 'cm-rendered-codeBlock' });
const cm = Decoration.mark({ class: 'cm-rendered-codeMark' });
const lk = Decoration.mark({ class: 'cm-rendered-link' });

const hls = HighlightStyle.define([
  { tag: tags.strong, fontWeight: '700' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.strikethrough, textDecoration: 'line-through', color: 'var(--text-tertiary)' },
  { tag: tags.monospace, fontFamily: "'Fira Code', 'Courier New', monospace", backgroundColor: 'var(--bg-surface-normal)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.9em' },
]);

export function livePreviewSyntaxHighlighting() { return syntaxHighlighting(hls); }

// ── Decorations ───────────────────────────────────────────────

function makeDecorations(view: EditorView, resolveUrl?: (s: string) => string): DecorationSet {
  const cs = cursors(view);
  const marks: { from: number; to: number; value: Decoration }[] = [];
  const tree = syntaxTree(view.state);
  const doc = view.state.doc;

  tree.iterate({
    enter(node: SyntaxNodeRef) {
      const line = doc.lineAt(node.from);
      const active = onLine(line.from, line.to, cs);
      const nm = node.type.name;

      if (nm === 'FencedCode') { marks.push(cb.range(node.from, node.to)); return false; }
      if (nm === 'CodeMark') { if (node.node.parent?.type.name === 'FencedCode') marks.push(cm.range(node.from, node.to)); else if (!active) marks.push(off.range(node.from, node.to)); return; }
      if (nm.startsWith('ATXHeading')) { const t = doc.sliceString(node.from, node.to); const m = t.match(/^(#{1,6})\s?/); if (m) { const pe = node.from + m[0].length; const ci = inRange(node.from, pe, cs); if (!active || !ci) marks.push(off.range(node.from, pe)); marks.push(hl[m[1]!.length]!.range(ci ? node.from : pe, node.to)); } return; }
      if (nm === 'StrongEmphasis') { const t = doc.sliceString(node.from, node.to); const ol = t.startsWith('**') || t.startsWith('__') ? 2 : 1; const cl = t.endsWith('**') || t.endsWith('__') ? 2 : 1; if (!inRange(node.from, node.from + ol, cs)) marks.push(off.range(node.from, node.from + ol)); if (!inRange(node.to - cl, node.to, cs)) marks.push(off.range(node.to - cl, node.to)); return; }
      if (nm === 'Emphasis') { const t = doc.sliceString(node.from, node.to); if (t.length < 3) return; if (!inRange(node.from, node.from + 1, cs)) marks.push(off.range(node.from, node.from + 1)); if (!inRange(node.to - 1, node.to, cs)) marks.push(off.range(node.to - 1, node.to)); return; }
      if (nm === 'Strikethrough') { if (!inRange(node.from, node.from + 2, cs)) marks.push(off.range(node.from, node.from + 2)); if (!inRange(node.to - 2, node.to, cs)) marks.push(off.range(node.to - 2, node.to)); return; }
      if (nm === 'InlineCode') { const t = doc.sliceString(node.from, node.to); const tl = t.startsWith('``') ? 2 : 1; if (!inRange(node.from, node.from + tl, cs)) marks.push(off.range(node.from, node.from + tl)); if (!inRange(node.to - tl, node.to, cs)) marks.push(off.range(node.to - tl, node.to)); return; }

      // ── Image ──
      if (nm === 'Image') {
        const text = doc.sliceString(node.from, node.to);
        if (text.includes('\n')) return; // 跨行不处理

        const p = parseImage(text);
        if (!p) return;
        const rsrc = resolveUrl ? resolveUrl(p.src) : p.src;

        if (active) {
          // 活动行：显示文本（可编辑）+ 图片
          marks.push({
            from: node.from, to: node.to,
            value: Decoration.replace({ widget: new ImageWidget(rsrc, p.alt, p.src, p.w, node.from, node.to, true, text) }),
          });
        } else {
          // 非活动行：仅图片
          marks.push({
            from: node.from, to: node.to,
            value: Decoration.replace({ widget: new ImageWidget(rsrc, p.alt, p.src, p.w, node.from, node.to) }),
          });
        }
        return;
      }

      // Link → 检查是否图片语法
      if (nm === 'Link') {
        const text = doc.sliceString(node.from, node.to);
        if (text.startsWith('![') && !text.includes('\n')) {
          const p = parseImage(text);
          if (p) {
            const rsrc = resolveUrl ? resolveUrl(p.src) : p.src;
            marks.push({ from: node.from, to: node.to, value: Decoration.replace({ widget: new ImageWidget(rsrc, p.alt, p.src, p.w, node.from, node.to) }) });
            return;
          }
        }
        const bo = text.indexOf('['), bc = text.indexOf('](');
        if (bo !== -1 && bc !== -1) {
          const of = node.from + bo, cf = node.from + bc;
          if (!inRange(of, of + 1, cs)) marks.push(off.range(of, of + 1));
          if (!inRange(cf, node.to, cs)) marks.push(off.range(cf, node.to));
          marks.push(lk.range(of + 1, cf));
        }
        return;
      }

      if (active) return;
      if (nm === 'QuoteMark') { marks.push(off.range(node.from, node.to)); return; }
      if (nm === 'ListMark') { marks.push(off.range(node.from, node.to)); return; }
      if (nm === 'TaskMarker') { marks.push(off.range(node.from, node.to)); return; }
    },
  });
  return Decoration.set(marks, true);
}

export function livePreviewPlugin(resolveUrl?: (s: string) => string) {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      constructor(view: EditorView) { this.decorations = makeDecorations(view, resolveUrl); }
      update(upd: ViewUpdate) {
        if (upd.docChanged || upd.selectionSet || upd.transactions.some(t => t.effects.some(e => e.is(forceImageRefresh)))) {
          this.decorations = makeDecorations(upd.view, resolveUrl);
        }
      }
    },
    { decorations: v => v.decorations },
  );
}
