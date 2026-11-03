import i18n from 'i18next'
import { WidgetType } from '@codemirror/view'
import { clampWidth, IMAGE_SIZE_CONFIG } from '../utils/image-utils'
import { invokeImageAction, invokeUpdateImageWidth } from '../extensions/effects'
import type { DiaryCmPlatform } from '../types'

/** 复用 DOM 时保留绑定了事件监听的实例，宽度变化或视口重挂载时原地更新、不重建图片 */
const boundWidgets = new WeakMap<HTMLElement, ImageWidget>()

const MAX_POOLED_DOM_NODES = 64
const detachedDomPool = new Map<string, HTMLElement[]>()
const measuredHeightBySrc = new Map<string, number>()

function isResolvedImageSrc(src: string): boolean {
  return Boolean(src && !src.startsWith('attachment/'))
}

function getTotalPooledCount(): number {
  let count = 0
  for (const list of detachedDomPool.values()) {
    count += list.length
  }
  return count
}

function releaseDomToPool(src: string, dom: HTMLElement): void {
  if (!isResolvedImageSrc(src)) return
  let list = detachedDomPool.get(src)
  if (!list) {
    list = []
    detachedDomPool.set(src, list)
  }
  if (list.includes(dom)) return
  while (getTotalPooledCount() >= MAX_POOLED_DOM_NODES) {
    const oldestKey = detachedDomPool.keys().next().value
    if (!oldestKey) break
    const oldestList = detachedDomPool.get(oldestKey)
    if (!oldestList || oldestList.length <= 1) {
      detachedDomPool.delete(oldestKey)
    } else {
      oldestList.shift()
    }
  }
  list.push(dom)
}

function acquireDomFromPool(src: string): HTMLElement | null {
  if (!isResolvedImageSrc(src)) return null
  const list = detachedDomPool.get(src)
  if (!list || list.length === 0) return null
  while (list.length > 0) {
    const candidate = list.pop()!
    if (!candidate.isConnected) {
      if (list.length === 0) detachedDomPool.delete(src)
      return candidate
    }
  }
  detachedDomPool.delete(src)
  return null
}

export class ImageWidget extends WidgetType {
  private container: HTMLElement | null = null
  private resizeHandle: HTMLElement | null = null
  private linkBar: HTMLElement | null = null
  private linkInput: HTMLInputElement | null = null
  private outsideClickHandler: ((e: MouseEvent) => void) | null = null

  constructor(
    private src: string,
    private alt: string,
    private width: number | undefined,
    private imageFrom: number | undefined,
    private imageTo: number | undefined,
    private showLinkBar: boolean = false,
    private srcRaw: string = '',
    private platform?: DiaryCmPlatform
  ) {
    super()
  }

  override get estimatedHeight(): number {
    return measuredHeightBySrc.get(this.src) ?? 220
  }

  eq(other: ImageWidget): boolean {
    return (
      this.src === other.src &&
      this.alt === other.alt &&
      this.width === other.width &&
      this.imageFrom === other.imageFrom &&
      this.imageTo === other.imageTo &&
      this.showLinkBar === other.showLinkBar
    )
  }

  private syncDomState(dom: HTMLElement): void {
    this.container = dom
    this.linkBar = dom.querySelector<HTMLElement>('.cm-image-link-bar')
    this.linkInput = dom.querySelector<HTMLInputElement>('.cm-image-link-input')
    this.resizeHandle = dom.querySelector<HTMLElement>('.cm-image-resize-handle')

    if (this.linkInput && this.linkInput.value !== this.src) {
      this.linkInput.value = this.src
    }
    if (this.linkBar) {
      this.linkBar.style.display = this.showLinkBar ? 'block' : 'none'
    }
    dom.classList.toggle('cm-image-active', this.showLinkBar)

    const img = dom.querySelector<HTMLImageElement>('img.cm-image-resizable')
    if (img) {
      img.alt = this.alt
      if (isResolvedImageSrc(this.src) && img.getAttribute('data-resolved-src') !== this.src) {
        img.setAttribute('data-resolved-src', this.src)
        img.src = this.src
      }
    }

    this.applyContainerWidth(dom)
    boundWidgets.set(dom, this)
  }

  private attachOutsideClickHandler(dom: HTMLElement): void {
    if (this.outsideClickHandler) {
      document.removeEventListener('click', this.outsideClickHandler)
    }
    this.outsideClickHandler = (e: MouseEvent) => {
      if (!dom.contains(e.target as Node)) {
        const linkBar = dom.querySelector<HTMLElement>('.cm-image-link-bar')
        if (linkBar) linkBar.style.display = 'none'
        dom.classList.remove('cm-image-active')
      }
    }
    document.addEventListener('click', this.outsideClickHandler)
  }

  /**
   * 宽度或地址变化时 CodeMirror 会先判 eq 不等、再走 updateDOM。
   * 这里原地更新 DOM，复用已加载的 img，避免重建时图片短暂失去高度或重新解码。
   */
  updateDOM(dom: HTMLElement): boolean {
    const bound = boundWidgets.get(dom)
    if (!bound) return false
    if (bound.src !== this.src && isResolvedImageSrc(bound.src) && isResolvedImageSrc(this.src)) {
      return false
    }

    if (bound.outsideClickHandler) {
      document.removeEventListener('click', bound.outsideClickHandler)
      bound.outsideClickHandler = null
    }

    this.syncDomState(dom)
    this.attachOutsideClickHandler(dom)
    return true
  }

  private applyContainerWidth(container: HTMLElement): void {
    if (this.width) {
      container.style.width = `${this.width}px`
      container.style.maxWidth = '100%'
      container.classList.remove('cm-image-container--unsized')
    } else {
      container.style.width = ''
      container.classList.add('cm-image-container--unsized')
      container.style.maxWidth = `${IMAGE_SIZE_CONFIG.defaultDisplayWidth}px`
    }
  }

  toDOM(): HTMLElement {
    const pooled = acquireDomFromPool(this.src)
    if (pooled) {
      this.syncDomState(pooled)
      this.attachOutsideClickHandler(pooled)
      return pooled
    }

    const container = document.createElement('div')
    container.className = 'cm-image-container'
    this.container = container
    this.applyContainerWidth(container)

    const cachedHeight = measuredHeightBySrc.get(this.src)
    if (cachedHeight && cachedHeight > 0) {
      container.style.minHeight = `${cachedHeight}px`
    }

    this.linkBar = document.createElement('div')
    this.linkBar.className = 'cm-image-link-bar'
    this.linkBar.style.display = this.showLinkBar ? 'block' : 'none'

    this.linkInput = document.createElement('input')
    this.linkInput.type = 'text'
    this.linkInput.className = 'cm-image-link-input'
    this.linkInput.value = this.src
    this.linkInput.readOnly = true

    this.linkBar.appendChild(this.linkInput)
    container.appendChild(this.linkBar)

    const img = document.createElement('img')
    img.alt = this.alt
    img.className = 'cm-image-resizable'
    img.draggable = false
    img.decoding = 'sync'
    img.addEventListener('load', () => {
      container.style.minHeight = ''
      const active = boundWidgets.get(container) ?? this
      const h = container.offsetHeight || img.offsetHeight
      if (h > 0 && isResolvedImageSrc(active.src)) {
        measuredHeightBySrc.set(active.src, h)
      }
    })
    img.addEventListener('error', () => {
      container.style.minHeight = ''
    })
    if (isResolvedImageSrc(this.src)) {
      img.setAttribute('data-resolved-src', this.src)
      img.src = this.src
    }
    container.appendChild(img)

    this.resizeHandle = document.createElement('div')
    this.resizeHandle.className = 'cm-image-resize-handle'
    container.appendChild(this.resizeHandle)

    if (this.showLinkBar) {
      container.classList.add('cm-image-active')
    }

    boundWidgets.set(container, this)
    this.bindEvents(container, img, this.resizeHandle)
    this.attachOutsideClickHandler(container)

    return container
  }

  destroy(dom: HTMLElement): void {
    const active = boundWidgets.get(dom) ?? this
    const h = dom.offsetHeight
    if (h > 0 && isResolvedImageSrc(active.src)) {
      measuredHeightBySrc.set(active.src, h)
    }
    if (this.outsideClickHandler) {
      document.removeEventListener('click', this.outsideClickHandler)
      this.outsideClickHandler = null
    }
    if (active.outsideClickHandler) {
      document.removeEventListener('click', active.outsideClickHandler)
      active.outsideClickHandler = null
    }
    releaseDomToPool(active.src, dom)
  }

  private bindEvents(container: HTMLElement, img: HTMLElement, resizeHandle: HTMLElement) {
    img.addEventListener('contextmenu', (e) => {
      const active = boundWidgets.get(container) ?? this
      const interactionMode = active.platform?.interactionMode ?? 'mouse'
      if (interactionMode !== 'mouse') return

      const isLocal = active.src.startsWith('local:///')
      if (!isLocal) return

      e.preventDefault()
      e.stopPropagation()

      const existingMenu = document.querySelector('.cm-context-menu')
      if (existingMenu) existingMenu.remove()

      const menu = document.createElement('div')
      menu.className = 'cm-context-menu'
      menu.style.left = `${e.clientX}px`
      menu.style.top = `${e.clientY}px`

      const items = [
        {
          label: i18n.t(
            'auto.packages.ui.src.shared.diary.codemirror.widgets.ImageWidget.L145',
            '复制图片'
          ),
          onClick: () => active.runImageAction('copy')
        },
        {
          label: i18n.t(
            'auto.packages.ui.src.shared.diary.codemirror.widgets.ImageWidget.L149',
            '打开所在文件夹'
          ),
          onClick: () => active.runImageAction('open')
        },
        {
          label: i18n.t(
            'auto.packages.ui.src.shared.diary.codemirror.widgets.ImageWidget.L153',
            '删除图片附件'
          ),
          isDanger: true,
          onClick: () => active.runImageAction('delete')
        }
      ]

      items.forEach((item) => {
        const btn = document.createElement('button')
        btn.className = `cm-context-menu-item ${item.isDanger ? 'danger' : ''}`
        btn.innerText = item.label
        btn.addEventListener('click', (ev) => {
          ev.stopPropagation()
          item.onClick()
          menu.remove()
        })
        menu.appendChild(btn)
      })

      document.body.appendChild(menu)

      const rect = menu.getBoundingClientRect()
      const windowWidth = window.innerWidth
      const windowHeight = window.innerHeight
      let newX = e.clientX
      let newY = e.clientY
      if (e.clientX + rect.width > windowWidth) {
        newX = Math.max(10, windowWidth - rect.width - 10)
      }
      if (e.clientY + rect.height > windowHeight) {
        newY = Math.max(10, windowHeight - rect.height - 10)
      }
      menu.style.left = `${newX}px`
      menu.style.top = `${newY}px`

      const closeMenu = () => {
        menu.remove()
        document.removeEventListener('click', closeMenu)
      }
      setTimeout(() => {
        document.addEventListener('click', closeMenu)
      }, 0)
    })

    img.addEventListener('click', (e) => {
      e.stopPropagation()
      const active = boundWidgets.get(container) ?? this
      const interactionMode = active.platform?.interactionMode ?? 'mouse'
      if (interactionMode === 'touch') {
        if (active.imageFrom !== undefined && active.imageTo !== undefined) {
          active.platform?.onImageTap?.({ from: active.imageFrom, to: active.imageTo })
        }
        return
      }
      const linkBar = container.querySelector<HTMLElement>('.cm-image-link-bar')
      if (linkBar) linkBar.style.display = 'block'
      container.classList.add('cm-image-active')
    })

    img.addEventListener('dblclick', (e) => {
      e.stopPropagation()
      e.preventDefault()
      const active = boundWidgets.get(container) ?? this
      const interactionMode = active.platform?.interactionMode ?? 'mouse'
      if (interactionMode === 'mouse') {
        active.platform?.onExternalImagePreview?.(active.src)
      }
    })

    let longPressTimer: ReturnType<typeof setTimeout> | null = null
    const clearLongPress = () => {
      if (longPressTimer) {
        clearTimeout(longPressTimer)
        longPressTimer = null
      }
    }
    img.addEventListener(
      'touchstart',
      () => {
        const active = boundWidgets.get(container) ?? this
        if ((active.platform?.interactionMode ?? 'mouse') !== 'touch') return
        clearLongPress()
        longPressTimer = setTimeout(() => {
          longPressTimer = null
          const current = boundWidgets.get(container) ?? active
          current.runImageAction('delete')
        }, 600)
      },
      { passive: true }
    )
    img.addEventListener('touchend', clearLongPress)
    img.addEventListener('touchmove', clearLongPress)
    img.addEventListener('touchcancel', clearLongPress)

    this.bindMouseResize(container, resizeHandle)
  }

  private bindMouseResize(container: HTMLElement, resizeHandle: HTMLElement) {
    let startX = 0
    let startWidth = 0

    resizeHandle.addEventListener('mousedown', (e) => {
      const active = boundWidgets.get(container) ?? this
      if ((active.platform?.interactionMode ?? 'mouse') !== 'mouse') return
      e.preventDefault()
      e.stopPropagation()
      startX = e.clientX
      startWidth = container.offsetWidth

      const onMouseMove = (ev: MouseEvent) => {
        const delta = ev.clientX - startX
        const newWidth = clampWidth(startWidth + delta)
        container.style.width = `${newWidth}px`
      }

      const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove)
        document.removeEventListener('mouseup', onMouseUp)
        const current = boundWidgets.get(container) ?? active
        current.commitWidth(container.offsetWidth)
      }

      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
    })

    container.addEventListener('wheel', (e) => {
      const active = boundWidgets.get(container) ?? this
      if ((active.platform?.interactionMode ?? 'mouse') !== 'mouse') return
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        const delta = e.deltaY > 0 ? -IMAGE_SIZE_CONFIG.step : IMAGE_SIZE_CONFIG.step
        const currentWidth = container.offsetWidth
        const newWidth = clampWidth(currentWidth + delta)
        container.style.width = `${newWidth}px`
        active.commitWidth(newWidth)
      }
    })
  }

  private runImageAction(action: 'delete' | 'copy' | 'open') {
    if (this.imageFrom === undefined || this.imageTo === undefined) return
    const payload = {
      from: this.imageFrom,
      to: this.imageTo,
      src: this.src,
      srcRaw: this.srcRaw || this.src
    }
    if (this.platform?.onImageAction) {
      this.platform.onImageAction(action, payload)
    } else {
      invokeImageAction(action, this.imageFrom, this.imageTo, this.src)
    }
  }

  private commitWidth(width?: number) {
    if (this.imageFrom === undefined || this.imageTo === undefined) return
    const newWidth = width ?? this.container!.offsetWidth
    invokeUpdateImageWidth(this.imageFrom, this.imageTo, newWidth)
  }

  ignoreEvent(): boolean {
    return false
  }
}
