/** 桌面表格 blocking overlay 状态（ckant TableState.interactive） */
let blockingCount = 0

export function beginDesktopTableBlocking(): () => void {
  blockingCount += 1
  return () => {
    blockingCount = Math.max(0, blockingCount - 1)
  }
}

export function isDesktopTableBlocking(): boolean {
  return blockingCount > 0
}

export function syncDesktopBlockingOverlay(block: HTMLElement): void {
  let overlay = block.querySelector('.cm-tbl-blocking-overlay') as HTMLElement | null
  if (isDesktopTableBlocking()) {
    if (!overlay) {
      overlay = document.createElement('div')
      overlay.className = 'cm-tbl-blocking-overlay'
      overlay.setAttribute('aria-hidden', 'true')
      block.querySelector('.cm-tbl-table-shell')?.appendChild(overlay)
    }
  } else {
    overlay?.remove()
  }
}

export function syncDesktopSelectAllOverlay(block: HTMLElement, selected: boolean): void {
  let overlay = block.querySelector('.cm-tbl-select-all-overlay') as HTMLElement | null
  if (selected) {
    if (!overlay) {
      overlay = document.createElement('div')
      overlay.className = 'cm-tbl-select-all-overlay'
      overlay.setAttribute('aria-hidden', 'true')
      block.querySelector('.cm-tbl-table-shell')?.appendChild(overlay)
    }
  } else {
    overlay?.remove()
  }
}
