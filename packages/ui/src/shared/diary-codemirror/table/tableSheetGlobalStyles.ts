/** 底部抽屉挂在 document.body，须用全局样式（CM baseTheme 仅作用于 .cm-editor 内） */
const STYLE_ID = 'cm-table-sheet-global-styles'

const SHEET_CSS = `
.cm-table-sheet-layer {
  position: fixed;
  z-index: 2147483000;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  pointer-events: none;
  overflow: hidden;
}
.cm-table-sheet-dismiss {
  flex: 1 1 auto;
  min-height: 0;
  pointer-events: auto;
  background: transparent;
}
.cm-table-sheet {
  position: relative;
  z-index: 1;
  flex: 0 0 auto;
  width: 100%;
  border-radius: 20px 20px 0 0;
  background: var(--bg-surface, #fff);
  border-top: 1px solid var(--border-subtle, rgba(0, 0, 0, 0.08));
  box-shadow: 0 -8px 32px rgba(0, 0, 0, 0.12);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  max-height: 72vh;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  color: var(--text-primary, #111);
  -webkit-font-smoothing: antialiased;
  pointer-events: auto;
  transform: translateY(100%);
  transition: transform 0.34s cubic-bezier(0.32, 0.72, 0, 1);
  will-change: transform;
}
.cm-table-sheet-layer--open .cm-table-sheet {
  transform: translateY(0);
}
.cm-table-sheet-layer--closing .cm-table-sheet {
  transform: translateY(100%);
}
.cm-table-sheet-grabber {
  width: 36px;
  height: 4px;
  border-radius: 999px;
  background: var(--border-subtle, rgba(0, 0, 0, 0.2));
  margin: 8px auto 2px;
  flex-shrink: 0;
}
.cm-table-sheet-title {
  text-align: center;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.01em;
  color: var(--text-secondary, #6b7280);
  padding: 6px 20px 12px;
  flex-shrink: 0;
}
.cm-table-sheet-body {
  padding: 0 12px calc(16px + env(safe-area-inset-bottom, 0px));
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}
.cm-table-sheet-group {
  border-radius: 12px;
  overflow: hidden;
  background: var(--bg-surface-normal, rgba(0, 0, 0, 0.04));
  box-shadow: inset 0 0 0 1px var(--border-subtle, rgba(0, 0, 0, 0.06));
}
.cm-table-sheet-group--destructive {
  margin-top: 2px;
}
.cm-table-sheet-item {
  display: flex;
  align-items: center;
  width: 100%;
  min-height: 52px;
  text-align: left;
  border: none;
  border-bottom: 1px solid var(--border-subtle, rgba(0, 0, 0, 0.06));
  background: transparent;
  color: var(--text-primary, #111);
  font-size: 16px;
  font-weight: 400;
  line-height: 1.3;
  padding: 14px 16px;
  margin: 0;
  cursor: pointer;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
  appearance: none;
  -webkit-appearance: none;
  box-sizing: border-box;
}
.cm-table-sheet-item:active:not(:disabled) {
  background: var(--bg-surface-normal, rgba(0, 0, 0, 0.06));
}
.cm-table-sheet-item:last-child {
  border-bottom: none;
}
.cm-table-sheet-item:disabled {
  opacity: 0.45;
}
.cm-table-sheet-item--destructive {
  color: var(--color-danger, #e5484d);
}
`

export function ensureTableSheetGlobalStyles(): void {
  if (typeof document === 'undefined') return
  const existing = document.getElementById(STYLE_ID)
  if (existing) {
    existing.textContent = SHEET_CSS
    return
  }
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = SHEET_CSS
  document.head.appendChild(style)
}
