import i18n from 'i18next'
import { WidgetType } from '@codemirror/view'
import { IMAGE_SIZE_CONFIG } from '../utils/image-utils'

/** 视口外图片的轻量占位，避免一次性创建大量 ImageWidget 与解码任务 */
export class ImagePlaceholderWidget extends WidgetType {
  constructor(
    private width: number | undefined,
    private alt: string
  ) {
    super()
  }

  eq(other: ImagePlaceholderWidget): boolean {
    return this.width === other.width && this.alt === other.alt
  }

  toDOM(): HTMLElement {
    const el = document.createElement('div')
    el.className = 'cm-image-placeholder'
    el.setAttribute('role', 'img')
    el.setAttribute(
      'aria-label',
      this.alt ||
        i18n.t(
          'auto.packages.ui.src.shared.diary.codemirror.widgets.ImagePlaceholderWidget.L21',
          '图片'
        )
    )
    if (this.width) {
      el.style.width = `${this.width}px`
      el.style.maxWidth = '100%'
    } else {
      el.style.maxWidth = `${IMAGE_SIZE_CONFIG.defaultDisplayWidth}px`
    }
    return el
  }

  ignoreEvent(): boolean {
    return false
  }
}
