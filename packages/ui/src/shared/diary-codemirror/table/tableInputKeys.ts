const SPECIAL_KEYS = new Set([
  'Alt',
  'Control',
  'Meta',
  'Shift',
  'Escape',
  'Enter',
  'Tab',
  'Backspace',
  'Delete',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Home',
  'End',
  'PageUp',
  'PageDown',
  'Insert',
  'CapsLock',
  'ContextMenu'
])

function isFunctionKey(key: string): boolean {
  return /^F\d{1,2}$/.test(key)
}

/** 可打印字符 → 进入单元格编辑（对齐 ckant InputKeys.pressed） */
export function isTableTypeToEditKey(event: KeyboardEvent): boolean {
  if (event.ctrlKey || event.metaKey || event.altKey) return false
  if (SPECIAL_KEYS.has(event.key) || isFunctionKey(event.key)) return false
  return event.key.length === 1
}
