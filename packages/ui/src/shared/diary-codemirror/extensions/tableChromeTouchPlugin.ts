import { type Extension } from '@codemirror/state'
import { EditorView, ViewPlugin } from '@codemirror/view'
import { parseTableFromDoc } from '../table/table.model'
import {
  dismissEditorKeyboardForChrome,
  isTableChromeTouchTarget,
  openChromeMenuForTrigger
} from '../table/tableContextMenu'
import {
  hitTestInteractableChromeAtPoint,
  isInteractableChromeElement
} from '../table/tableChromeHitTest'
import { shouldBlockEditorTouchForTableSheet } from '../table/tableSheetInteraction'
import {
  TABLE_CHROME_LONG_PRESS_MS,
  TABLE_CHROME_LONG_PRESS_MOVE_TOLERANCE_PX
} from '../table/tableChromeTouchConstants'
import { logTableChrome } from '../table/tableChromeDebug'
import type { DiaryCmPlatform } from '../types'

const CAPTURE_OPTS = { capture: true, passive: false } as const

function isImmediateChromeAction(trigger: HTMLElement): boolean {
  return (
    trigger.classList.contains('cm-table-add-row') || trigger.classList.contains('cm-table-add-col')
  )
}

function resolveTouchTarget(view: EditorView, event: TouchEvent): HTMLElement | null {
  if (event.target instanceof Element) {
    const fromTarget = isTableChromeTouchTarget(event.target)
    if (fromTarget && isInteractableChromeElement(fromTarget)) return fromTarget
  }

  const touch = event.changedTouches[0] ?? event.touches[0]
  if (!touch) return null
  return hitTestInteractableChromeAtPoint(view, touch.clientX, touch.clientY)
}

function resolveTableFromBlock(block: HTMLElement, view: EditorView) {
  const tableFrom = Number(block.dataset.tableFrom)
  const tableTo = Number(block.dataset.tableTo)
  if (Number.isNaN(tableFrom) || Number.isNaN(tableTo)) return null
  return parseTableFromDoc(view.state.doc, tableFrom, tableTo)
}

function openChromeFromTrigger(view: EditorView, trigger: HTMLElement, event: TouchEvent): void {
  const block = trigger.closest('.cm-table-block') as HTMLElement | null
  if (!block || !view.dom.contains(block)) return

  const table = resolveTableFromBlock(block, view)
  if (!table) return

  logTableChrome('tableChromeTouchPlugin', {
    event: event.type,
    trigger: trigger.className,
    longPress: !isImmediateChromeAction(trigger)
  })

  event.preventDefault()
  event.stopPropagation()

  dismissEditorKeyboardForChrome(view)
  openChromeMenuForTrigger(view, trigger, table)
}

/**
 * 触摸端：+ 按钮轻点即执行；列/行把手与角落菜单需长按。
 */
export function tableChromeTouchPlugin(platform?: DiaryCmPlatform): Extension {
  if (platform?.interactionMode !== 'touch') return []

  return ViewPlugin.fromClass(
    class {
      private pressTimer: ReturnType<typeof setTimeout> | null = null
      private pressTrigger: HTMLElement | null = null
      private pressStartX = 0
      private pressStartY = 0
      private pressEvent: TouchEvent | null = null

      private readonly onTouchStart = (event: TouchEvent) => this.handleTouchStart(event)
      private readonly onTouchMove = (event: TouchEvent) => this.handleTouchMove(event)
      private readonly onTouchEnd = (event: TouchEvent) => this.handleTouchEnd(event)
      private readonly onTouchCancel = () => this.clearLongPress()

      constructor(private readonly view: EditorView) {
        document.addEventListener('touchstart', this.onTouchStart, CAPTURE_OPTS)
        document.addEventListener('touchmove', this.onTouchMove, CAPTURE_OPTS)
        document.addEventListener('touchend', this.onTouchEnd, CAPTURE_OPTS)
        document.addEventListener('touchcancel', this.onTouchCancel, CAPTURE_OPTS)
      }

      destroy(): void {
        this.clearLongPress()
        document.removeEventListener('touchstart', this.onTouchStart, CAPTURE_OPTS)
        document.removeEventListener('touchmove', this.onTouchMove, CAPTURE_OPTS)
        document.removeEventListener('touchend', this.onTouchEnd, CAPTURE_OPTS)
        document.removeEventListener('touchcancel', this.onTouchCancel, CAPTURE_OPTS)
      }

      private clearLongPress(): void {
        if (this.pressTimer !== null) {
          clearTimeout(this.pressTimer)
          this.pressTimer = null
        }
        this.pressTrigger = null
        this.pressEvent = null
      }

      private handleTouchStart(event: TouchEvent): void {
        if (shouldBlockEditorTouchForTableSheet()) return

        const trigger = resolveTouchTarget(this.view, event)
        if (!trigger) return

        if (isImmediateChromeAction(trigger)) {
          openChromeFromTrigger(this.view, trigger, event)
          return
        }

        event.preventDefault()
        event.stopPropagation()
        dismissEditorKeyboardForChrome(this.view)

        const touch = event.touches[0]
        if (!touch) return

        this.clearLongPress()
        this.pressTrigger = trigger
        this.pressEvent = event
        this.pressStartX = touch.clientX
        this.pressStartY = touch.clientY

        this.pressTimer = setTimeout(() => {
          this.pressTimer = null
          if (shouldBlockEditorTouchForTableSheet()) return
          const activeTrigger = this.pressTrigger
          const activeEvent = this.pressEvent
          this.pressTrigger = null
          this.pressEvent = null
          if (!activeTrigger || !activeEvent) return
          try {
            navigator.vibrate?.(12)
          } catch {
            /* ignore */
          }
          openChromeFromTrigger(this.view, activeTrigger, activeEvent)
        }, TABLE_CHROME_LONG_PRESS_MS)
      }

      private handleTouchEnd(event: TouchEvent): void {
        const activeTrigger = this.pressTrigger
        this.clearLongPress()

        if (activeTrigger && isInteractableChromeElement(activeTrigger)) {
          event.preventDefault()
          event.stopPropagation()
          dismissEditorKeyboardForChrome(this.view)
          return
        }

        if (shouldBlockEditorTouchForTableSheet()) return

        if (event.target instanceof Element) {
          const fromTarget = isTableChromeTouchTarget(event.target)
          if (fromTarget && isInteractableChromeElement(fromTarget)) {
            event.preventDefault()
            event.stopPropagation()
            dismissEditorKeyboardForChrome(this.view)
          }
        }
      }

      private handleTouchMove(event: TouchEvent): void {
        if (!this.pressTimer || !this.pressTrigger) return
        const touch = event.touches[0]
        if (!touch) return
        const dx = touch.clientX - this.pressStartX
        const dy = touch.clientY - this.pressStartY
        if (Math.hypot(dx, dy) > TABLE_CHROME_LONG_PRESS_MOVE_TOLERANCE_PX) {
          this.clearLongPress()
        }
      }
    }
  )
}
