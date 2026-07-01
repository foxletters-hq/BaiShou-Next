import { Decoration, WidgetType } from '@codemirror/view'

class ListBulletWidget extends WidgetType {
  toDOM(): HTMLElement {
    const el = document.createElement('span')
    el.className = 'cm-list-bullet'
    el.textContent = '•'
    el.setAttribute('aria-hidden', 'true')
    return el
  }

  eq(): boolean {
    return true
  }

  ignoreEvent(): boolean {
    return true
  }
}

const listBulletWidget = new ListBulletWidget()

/** 将 `- ` 等列表标记替换为圆点 */
export const listMarkerReplace = Decoration.replace({
  widget: listBulletWidget,
  inclusive: false
})

export const hideMark = Decoration.replace({})

export const headingStyles: Record<number, Decoration> = {
  1: Decoration.mark({ class: 'cm-rendered-h1' }),
  2: Decoration.mark({ class: 'cm-rendered-h2' }),
  3: Decoration.mark({ class: 'cm-rendered-h3' }),
  4: Decoration.mark({ class: 'cm-rendered-h4' }),
  5: Decoration.mark({ class: 'cm-rendered-h5' }),
  6: Decoration.mark({ class: 'cm-rendered-h6' })
}

export const codeBlockMark = Decoration.mark({ class: 'cm-rendered-codeBlock' })
export const codeMarkStyle = Decoration.mark({ class: 'cm-rendered-codeMark' })
export const linkMark = Decoration.mark({ class: 'cm-rendered-link' })

export const tableSeparatorLineStyle = Decoration.line({ class: 'cm-table-separator-line' })

export const codeLineStyle = Decoration.line({ class: 'cm-code-line' })
export const codeLineStyleTop = Decoration.line({
  class: 'cm-code-line cm-code-line-top'
})
export const codeLineStyleBottom = Decoration.line({
  class: 'cm-code-line cm-code-line-bottom'
})
export const codeLineStyleSingle = Decoration.line({
  class: 'cm-code-line cm-code-line-top cm-code-line-bottom'
})
