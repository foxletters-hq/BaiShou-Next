import { confirmMessageForDestructiveItem, requestTableConfirm } from './tableConfirm'
import {
  ensureTableSheetGlobalStyles,
  ensureTableContextMenuGlobalStyles
} from './tableSheetGlobalStyles'
import {
  dismissKeyboardForSheetInteraction,
  markTableSheetClosed,
  markTableSheetOpen
} from './tableSheetInteraction'
import { requestNativeTableSheet, closeNativeTableSheets } from './tableNativeSheet'
import { applyFixedContextMenuLayout } from '../../../desktop/ContextMenu/context-menu-placement.util'
import { logTableChrome } from './tableChromeDebug'
import type { TableMenuItem, TableMenuSection } from './table-context-menu.types'

export const MENU_LAYER_SELECTOR = '.cm-table-context-menu-layer, .cm-table-sheet-layer'

let lastChromeMenuOpenAt = 0

export function resetChromeMenuOpenAt(): void {
  lastChromeMenuOpenAt = 0
}

export function markChromeMenuOpened(): number {
  lastChromeMenuOpenAt = Date.now()
  return lastChromeMenuOpenAt
}

export function getLastChromeMenuOpenAt(): number {
  return lastChromeMenuOpenAt
}

export function closeAllTableMenus(): void {
  closeNativeTableSheets()
  document.querySelectorAll(MENU_LAYER_SELECTOR).forEach((el) => el.remove())
  resetChromeMenuOpenAt()
}

function pickMenuItem(
  btn: HTMLButtonElement,
  item: TableMenuItem,
  onPick: (id: string) => void,
  close: () => void
): void {
  let picked = false
  const runPick = async () => {
    if (item.destructive) {
      const confirmed = await requestTableConfirm(confirmMessageForDestructiveItem(item), {
        destructive: true
      })
      if (!confirmed) {
        picked = false
        return
      }
    }
    onPick(item.id)
    close()
  }
  const pick = (e: Event) => {
    e.preventDefault()
    e.stopPropagation()
    if (picked || item.disabled) return
    picked = true
    void runPick()
  }
  btn.addEventListener('click', pick)
  btn.addEventListener('touchstart', pick, { passive: false })
}

export function showTableContextMenu(
  items: TableMenuItem[],
  clientX: number,
  clientY: number,
  onPick: (id: string) => void
): void {
  showTableMenuPopup(items, clientX, clientY, onPick)
}

function unlockPageOverflowForSheet(): void {
  document.documentElement.style.overflow = 'visible'
  document.body.style.overflow = 'visible'
}

function restorePageOverflowAfterSheet(): void {
  if (document.querySelector(MENU_LAYER_SELECTOR)) return
  document.documentElement.style.overflow = 'hidden'
  document.body.style.overflow = 'hidden'
}

function getVisualViewportBox(): { top: number; left: number; width: number; height: number } {
  const vv = window.visualViewport
  return {
    top: vv?.offsetTop ?? 0,
    left: vv?.offsetLeft ?? 0,
    width: vv?.width ?? window.innerWidth,
    height: vv?.height ?? window.innerHeight
  }
}

/** 菜单贴 WebView 视口最底（不预留 RN 工具栏高度；工具栏在 WebView 外） */
function pinTableSheetToVisualViewport(layer: HTMLElement, sheet: HTMLElement): () => void {
  const apply = () => {
    const box = getVisualViewportBox()
    const layerTop = box.top
    const layerHeight = Math.max(box.height, window.innerHeight - box.top)

    layer.style.position = 'fixed'
    layer.style.top = `${layerTop}px`
    layer.style.left = `${box.left}px`
    layer.style.width = `${box.width}px`
    layer.style.height = `${layerHeight}px`
    layer.style.right = 'auto'
    layer.style.bottom = 'auto'
    layer.style.display = 'flex'
    layer.style.flexDirection = 'column'
    layer.style.justifyContent = 'flex-end'
    layer.style.zIndex = '2147483000'
    layer.style.pointerEvents = 'none'
    layer.style.overflow = 'hidden'

    sheet.style.marginBottom = '0'
    sheet.style.maxHeight = `${Math.max(200, layerHeight * 0.72)}px`
  }

  apply()
  const vv = window.visualViewport
  vv?.addEventListener('resize', apply)
  vv?.addEventListener('scroll', apply)
  window.addEventListener('resize', apply)
  return () => {
    vv?.removeEventListener('resize', apply)
    vv?.removeEventListener('scroll', apply)
    window.removeEventListener('resize', apply)
  }
}

const SHEET_CLOSE_MS = 360

function animateCloseTableSheet(layer: HTMLElement, sheet: HTMLElement, onDone: () => void): void {
  let finished = false
  const finish = () => {
    if (finished) return
    finished = true
    onDone()
  }

  layer.classList.remove('cm-table-sheet-layer--open')
  layer.classList.add('cm-table-sheet-layer--closing')
  sheet.addEventListener('transitionend', finish, { once: true })
  window.setTimeout(finish, SHEET_CLOSE_MS)
}

export function showTableBottomSheet(
  title: string,
  sections: TableMenuSection[],
  onPick: (id: string) => void,
  onClose?: () => void
): void {
  closeAllTableMenus()
  if (requestNativeTableSheet(title, sections, onPick, onClose)) {
    logTableChrome('showTableBottomSheet:native', {
      title,
      itemCount: sections.reduce((n, s) => n + s.items.length, 0)
    })
    return
  }
  showDomTableBottomSheet(title, sections, onPick, onClose)
}

function showDomTableBottomSheet(
  title: string,
  sections: TableMenuSection[],
  onPick: (id: string) => void,
  onClose?: () => void
): void {
  ensureTableSheetGlobalStyles()
  logTableChrome('showTableBottomSheet:start', {
    title,
    itemCount: sections.reduce((n, s) => n + s.items.length, 0)
  })

  const layer = document.createElement('div')
  layer.className = 'cm-table-sheet-layer'

  const dismissZone = document.createElement('div')
  dismissZone.className = 'cm-table-sheet-dismiss'
  dismissZone.setAttribute('aria-hidden', 'true')

  const sheet = document.createElement('div')
  sheet.className = 'cm-table-sheet'
  sheet.setAttribute('role', 'dialog')
  sheet.setAttribute('aria-label', title)

  const grabber = document.createElement('div')
  grabber.className = 'cm-table-sheet-grabber'
  sheet.appendChild(grabber)

  if (title) {
    const heading = document.createElement('div')
    heading.className = 'cm-table-sheet-title'
    heading.textContent = title
    sheet.appendChild(heading)
  }

  const body = document.createElement('div')
  body.className = 'cm-table-sheet-body'

  let unpinViewport = () => {}

  const finishClose = () => {
    unpinViewport()
    layer.remove()
    restorePageOverflowAfterSheet()
    markTableSheetClosed()
    onClose?.()
  }

  const close = () => {
    if (layer.classList.contains('cm-table-sheet-layer--closing')) return
    dismissKeyboardForSheetInteraction()
    animateCloseTableSheet(layer, sheet, finishClose)
  }

  const openedAt = Date.now()
  const canClose = () => Date.now() - openedAt > 280

  const closeFromDismiss = (e: Event) => {
    if (!canClose()) {
      e.preventDefault()
      e.stopPropagation()
      return
    }
    e.preventDefault()
    e.stopPropagation()
    dismissKeyboardForSheetInteraction()
    close()
  }

  dismissZone.addEventListener('touchstart', closeFromDismiss, { passive: false })
  dismissZone.addEventListener('click', closeFromDismiss)

  for (const section of sections) {
    const group = document.createElement('div')
    group.className = 'cm-table-sheet-group'
    if (section.items.every((item) => item.destructive)) {
      group.classList.add('cm-table-sheet-group--destructive')
    }
    for (const item of section.items) {
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'cm-table-sheet-item'
      if (item.destructive) btn.classList.add('cm-table-sheet-item--destructive')
      btn.textContent = item.label
      btn.disabled = Boolean(item.disabled)
      btn.setAttribute('role', 'menuitem')
      pickMenuItem(btn, item, onPick, close)
      group.appendChild(btn)
    }
    body.appendChild(group)
  }

  sheet.appendChild(body)
  layer.appendChild(dismissZone)
  layer.appendChild(sheet)
  unlockPageOverflowForSheet()
  markTableSheetOpen()
  document.body.appendChild(layer)
  unpinViewport = pinTableSheetToVisualViewport(layer, sheet)

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      layer.classList.add('cm-table-sheet-layer--open')
    })
  })

  const box = getVisualViewportBox()
  const rect = sheet.getBoundingClientRect()
  logTableChrome('showTableBottomSheet:mounted', {
    title,
    sheetTop: rect.top,
    sheetBottom: rect.bottom,
    sheetHeight: rect.height,
    viewportH: window.innerHeight,
    visualViewportH: box.height,
    visualViewportTop: box.top,
    inDom: document.body.contains(layer),
    htmlOverflow: document.documentElement.style.overflow,
    bodyOverflow: document.body.style.overflow
  })
}

function showTableMenuPopup(
  items: TableMenuItem[],
  clientX: number,
  clientY: number,
  onPick: (id: string) => void
): void {
  closeAllTableMenus()
  ensureTableContextMenuGlobalStyles()

  const layer = document.createElement('div')
  layer.className = 'cm-table-context-menu-layer'

  const backdrop = document.createElement('div')
  backdrop.className = 'cm-table-context-menu-backdrop'
  backdrop.setAttribute('aria-hidden', 'true')

  const menu = document.createElement('div')
  menu.className = 'cm-table-context-menu'
  menu.setAttribute('role', 'menu')
  menu.style.left = `${clientX}px`
  menu.style.top = `${clientY}px`

  const openedAt = Date.now()
  const close = () => layer.remove()
  const canCloseFromBackdrop = () => Date.now() - openedAt > 360

  const absorbPointer = (e: Event) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const closeFromBackdrop = (e: Event) => {
    if (!canCloseFromBackdrop()) {
      absorbPointer(e)
      return
    }
    absorbPointer(e)
    close()
  }

  backdrop.addEventListener('mousedown', closeFromBackdrop)
  backdrop.addEventListener('click', closeFromBackdrop)
  backdrop.addEventListener('touchend', closeFromBackdrop, { passive: false })

  const stopMenuBubble = (e: Event) => {
    e.stopPropagation()
  }
  menu.addEventListener('mousedown', stopMenuBubble)
  menu.addEventListener('mouseup', stopMenuBubble)
  menu.addEventListener('click', stopMenuBubble)
  menu.addEventListener('touchstart', stopMenuBubble, { passive: true })
  menu.addEventListener('touchend', stopMenuBubble, { passive: true })

  for (const item of items) {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'cm-table-context-menu-item'
    if (item.destructive) btn.classList.add('cm-table-context-menu-item--destructive')
    btn.textContent = item.label
    btn.disabled = Boolean(item.disabled)
    btn.setAttribute('role', 'menuitem')
    pickMenuItem(btn, item, onPick, close)
    menu.appendChild(btn)
  }

  layer.appendChild(backdrop)
  layer.appendChild(menu)
  document.body.appendChild(layer)

  requestAnimationFrame(() => {
    applyFixedContextMenuLayout(menu, clientX, clientY)
  })
}
