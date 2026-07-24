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
export const listMarkerReplaceSpec = {
  widget: listBulletWidget,
  inclusive: false as const
}
export const listMarkerReplace = Decoration.replace(listMarkerReplaceSpec)

class HiddenSyntaxWidget extends WidgetType {
  toDOM(): HTMLElement {
    const el = document.createElement('span')
    el.className = 'cm-syntax-hidden-widget'
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

const hiddenSyntaxWidget = new HiddenSyntaxWidget()

/**
 * 隐藏语法 token（与列表圆点同机制：replace + widget）。
 * RN WebView 上 Decoration.line / Decoration.mark / empty replace 均不进 DOM。
 */
export const hideSyntaxReplace = Decoration.replace({
  widget: hiddenSyntaxWidget,
  inclusive: false
})

/** 桌面端：空 replace 隐藏语法，避免 widget 槽位冲突（atomic-editor 策略） */
export const hideSyntaxEmptyReplace = Decoration.replace({})

export function hideSyntaxReplaceSpec(
  touchMode: boolean
): Parameters<typeof Decoration.replace>[0] {
  return touchMode ? { widget: hiddenSyntaxWidget, inclusive: false } : {}
}

/** 用 mark 隐藏前缀（touch 端 blockquote 备用） */
export const hideSyntaxMark = Decoration.mark({
  class: 'cm-syntax-hidden-mark',
  inclusive: false
})

/** @deprecated 使用 hideSyntaxReplace */
export const hideSyntax = hideSyntaxReplace

/** @deprecated 使用 hideSyntaxReplace */
export const hideMark = hideSyntaxReplace

export const blockquoteLineStyle = Decoration.line({ class: 'cm-rendered-blockquote' })

export const inlineCodeMark = Decoration.mark({ class: 'cm-rendered-inline-code' })

export const headingLineStyles: Record<number, Decoration> = {
  1: Decoration.line({ class: 'cm-rendered-h1' }),
  2: Decoration.line({ class: 'cm-rendered-h2' }),
  3: Decoration.line({ class: 'cm-rendered-h3' }),
  4: Decoration.line({ class: 'cm-rendered-h4' }),
  5: Decoration.line({ class: 'cm-rendered-h5' }),
  6: Decoration.line({ class: 'cm-rendered-h6' })
}

/** @deprecated 使用 headingLineStyles */
export const headingStyles = headingLineStyles

export const codeBlockMark = Decoration.mark({ class: 'cm-rendered-codeBlock' })
export const codeMarkStyle = Decoration.mark({ class: 'cm-rendered-codeMark' })
export const linkMark = Decoration.mark({ class: 'cm-rendered-link' })

export const tableSeparatorLineStyle = Decoration.line({ class: 'cm-table-separator-line' })

class HorizontalRuleWidget extends WidgetType {
  toDOM(): HTMLElement {
    const el = document.createElement('span')
    el.className = 'cm-wb-hr-widget'
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

const horizontalRuleWidget = new HorizontalRuleWidget()

/** 将 `---` / `***` / `___` 行替换为视觉分割线（触摸端必须用 widget） */
export const hrWidgetReplaceSpec = {
  widget: horizontalRuleWidget,
  inclusive: false as const
}

export const hrLineStyle = Decoration.line({ class: 'cm-wb-hr' })

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
