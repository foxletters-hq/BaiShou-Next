import { ViewPlugin, type EditorView } from '@codemirror/view'
import type { Extension } from '@codemirror/state'
import type { DiaryCmPlatform } from '../../types'
import { applyCkantTableMenuI18n, type DiaryTableMenuTranslate } from './tableMenuI18n.util'
import { applyCkantTableMenuPlacement } from './tableMenuPlacement.util'

function createTranslator(platform: DiaryCmPlatform): DiaryTableMenuTranslate {
  if (platform.translate) {
    return (key, defaultValue) => platform.translate!(key, defaultValue)
  }
  return (_key, defaultValue) => defaultValue
}

function mutationTouchesTableMenu(mutations: MutationRecord[]): boolean {
  for (const mutation of mutations) {
    if (mutation.type !== 'childList') continue
    for (const node of mutation.addedNodes) {
      if (!(node instanceof Element)) continue
      if (
        node.classList.contains('tbl-menu-tooltip') ||
        node.classList.contains('tbl-menu') ||
        node.querySelector('.tbl-menu-item-text')
      ) {
        return true
      }
    }
  }
  return false
}

/** 将 codemirror-markdown-tables 英文菜单替换为 i18n 文案 */
export function tableMenuI18nPlugin(platform: DiaryCmPlatform): Extension {
  if (platform.interactionMode !== 'mouse') return []

  const translate = createTranslator(platform)

  return ViewPlugin.fromClass(
    class {
      private observer: MutationObserver | null = null
      private raf = 0
      private placementRaf = 0

      constructor(private view: EditorView) {
        const run = () => {
          this.observer?.disconnect()
          try {
            applyCkantTableMenuI18n(this.view.dom, translate)
            applyCkantTableMenuPlacement(this.view.dom)
          } finally {
            this.observer?.observe(this.view.dom, { childList: true, subtree: true })
          }
        }

        const schedulePlacement = () => {
          if (this.placementRaf) cancelAnimationFrame(this.placementRaf)
          this.placementRaf = requestAnimationFrame(() => {
            this.placementRaf = requestAnimationFrame(() => {
              this.placementRaf = 0
              applyCkantTableMenuPlacement(this.view.dom)
            })
          })
        }

        const schedule = (mutations: MutationRecord[]) => {
          if (!mutationTouchesTableMenu(mutations)) return
          if (this.raf) cancelAnimationFrame(this.raf)
          this.raf = requestAnimationFrame(() => {
            this.raf = 0
            run()
            schedulePlacement()
          })
        }

        this.observer = new MutationObserver(schedule)
        this.observer.observe(this.view.dom, { childList: true, subtree: true })
      }

      destroy() {
        if (this.raf) cancelAnimationFrame(this.raf)
        if (this.placementRaf) cancelAnimationFrame(this.placementRaf)
        this.observer?.disconnect()
      }
    }
  )
}
