import { resolveWorkbenchCommentPopoverPosition } from './workbench-comment-popover.util'

export function splitRelativePath(relativePath: string): string[] {
  return relativePath.split(/[/\\]/).filter(Boolean)
}

export function tabIconName(tab: { title: string; relativePath?: string }): string {
  return tab.relativePath || tab.title
}

export function isPositiveLine(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 1
}

export function addSelectionShortcutLabel(
  platform = typeof navigator !== 'undefined' ? navigator.platform : ''
): string {
  if (/Mac|iPhone|iPad/i.test(platform)) {
    return '⌘⇧L'
  }
  return 'Ctrl+Shift+L'
}

export function commentPopoverPosition(
  anchor: { x?: number; y?: number },
  viewport = {
    width: typeof window !== 'undefined' ? window.innerWidth : 1280,
    height: typeof window !== 'undefined' ? window.innerHeight : 800
  }
): { x: number; y: number } {
  return resolveWorkbenchCommentPopoverPosition({
    x: anchor.x,
    y: anchor.y,
    windowWidth: viewport.width,
    windowHeight: viewport.height
  })
}
