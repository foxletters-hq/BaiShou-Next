import { WidgetType } from '@codemirror/view'
import { clampWidth, IMAGE_SIZE_CONFIG } from './image-utils'
import { invokeImageAction, invokeUpdateImageWidth } from './codeMirrorDecorations.effects'

export class ImageWidget extends WidgetType {
  private container: HTMLElement | null = null
  private resizeHandle: HTMLElement | null = null
  private linkBar: HTMLElement | null = null
  private linkInput: HTMLInputElement | null = null

  constructor(
    private src: string,
    private alt: string,
    private width?: number,
    private imageFrom?: number,
    private imageTo?: number,
    private showLinkBar: boolean = false
  ) {
    super()
  }

  eq(other: ImageWidget): boolean {
    return (
      this.src === other.src &&
      this.alt === other.alt &&
      this.width === other.width &&
      this.showLinkBar === other.showLinkBar
    )
  }

  toDOM(): HTMLElement {
    this.container = document.createElement('div')
    this.container.className = 'cm-image-container'
    if (this.width) {
      this.container.style.width = `${this.width}px`
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
    this.container.appendChild(this.linkBar)

    const img = document.createElement('img')
    img.src = this.src
    img.alt = this.alt
    img.className = 'cm-image-resizable'
    img.draggable = false
    this.container.appendChild(img)

    this.resizeHandle = document.createElement('div')
    this.resizeHandle.className = 'cm-image-resize-handle'
    this.container.appendChild(this.resizeHandle)

    if (this.showLinkBar) {
      this.container.classList.add('cm-image-active')
    }

    this.bindEvents(img)

    return this.container
  }

  private bindEvents(img: HTMLElement) {
    if (!this.container || !this.resizeHandle || !this.linkBar) return

    img.addEventListener('contextmenu', (e) => {
      const isLocal = this.src.startsWith('local:///')
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
          label: '复制图片',
          onClick: () => this.runImageAction('copy')
        },
        {
          label: '打开所在文件夹',
          onClick: () => this.runImageAction('open')
        },
        {
          label: '删除图片附件',
          isDanger: true,
          onClick: () => this.runImageAction('delete')
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
      this.linkBar!.style.display = 'block'
      this.container!.classList.add('cm-image-active')
    })

    document.addEventListener('click', (e) => {
      if (!this.container!.contains(e.target as Node)) {
        this.linkBar!.style.display = 'none'
        this.container!.classList.remove('cm-image-active')
      }
    })

    let startX = 0
    let startWidth = 0

    this.resizeHandle.addEventListener('mousedown', (e) => {
      e.preventDefault()
      e.stopPropagation()
      startX = e.clientX
      startWidth = this.container!.offsetWidth

      const onMouseMove = (ev: MouseEvent) => {
        const delta = ev.clientX - startX
        const newWidth = clampWidth(startWidth + delta)
        this.container!.style.width = `${newWidth}px`
      }

      const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove)
        document.removeEventListener('mouseup', onMouseUp)
        this.commitWidth()
      }

      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
    })

    this.container.addEventListener('wheel', (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        const delta = e.deltaY > 0 ? -IMAGE_SIZE_CONFIG.step : IMAGE_SIZE_CONFIG.step
        const currentWidth = this.container!.offsetWidth
        const newWidth = clampWidth(currentWidth + delta)
        this.container!.style.width = `${newWidth}px`
        this.commitWidth(newWidth)
      }
    })
  }

  private runImageAction(action: 'delete' | 'copy' | 'open') {
    if (this.imageFrom === undefined || this.imageTo === undefined) return
    invokeImageAction(action, this.imageFrom, this.imageTo, this.src)
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
