/**
 * 禁止在业务 TS/TSX 里写死字号。
 * 正文用 mobileTypography / uiTypography / settingsTypography；
 * 图标用 iconSizes / settingsIcons；展示大标题用 displaySizes。
 * 见 docs/1-AI-Code/2-UI-Theme-Rule.md §3.3a / §3.3b / §3.9。
 */

const MESSAGE =
  '不要写死字号。正文用 mobileTypography / uiTypography / settingsTypography，图标用 iconSizes / settingsIcons，展示大标题用 displaySizes。见 docs/1-AI-Code/2-UI-Theme-Rule.md §3.3a / §3.3b / §3.9。'

const TOKEN_MEMBER_ROOTS = new Set([
  'mobileTypography',
  'settingsTypography',
  'uiTypography',
  'settingsIcons',
  'iconSizes',
  'displaySizes'
])
const SIZE_IDENTIFIERS = new Set(['size', 'iconSize', 'fontSize', 'width', 'height'])
const MATH_ROUNDERS = new Set(['round', 'ceil', 'floor'])

const HARDCODED_PX = /\d+(?:\.\d+)?(?:px|pt|rem)\b/
const HARDCODED_BARE = /^\d+(?:\.\d+)?$/
const TEMPLATE_FONT_SIZE_PX = /font-size\s*:\s*\d+(?:\.\d+)?(?:px|pt|rem)\b/i
const LETTERS = /[A-Za-z\u4e00-\u9fa5]/

function isTestFile(filename) {
  const normalized = filename.replace(/\\/g, '/')
  return (
    /(?:^|\/)(?:__tests__|tests)(?:\/|$)/.test(normalized) ||
    /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(normalized)
  )
}

function isExemptFile(filename) {
  const normalized = filename.replace(/\\/g, '/')
  if (isTestFile(normalized)) return true
  if (normalized.endsWith('/theme/tokens.ts')) return true
  if (normalized.includes('/KnowledgeScreen/')) return true
  if (normalized.includes('/KnowledgeCitationBlock/')) return true
  if (normalized.endsWith('/hello-wave.tsx')) return true
  if (normalized.endsWith('/AgentScrollDebugHud.tsx')) return true
  return false
}

function keyName(keyNode) {
  if (!keyNode) return ''
  if (keyNode.type === 'Identifier') return keyNode.name
  if (keyNode.type === 'Literal') return String(keyNode.value ?? '')
  return ''
}

function enclosingStyleKey(propertyNode) {
  const obj = propertyNode.parent
  if (obj?.type !== 'ObjectExpression') return ''
  const holder = obj.parent
  if (holder?.type === 'Property') return keyName(holder.key)
  return ''
}

function isGlyphKey(name) {
  return /(icon|chevron|arrow|emoji|glyph)/i.test(name)
}

function isTokenMember(node) {
  let current = node
  while (current?.type === 'MemberExpression') {
    current = current.object
  }
  return current?.type === 'Identifier' && TOKEN_MEMBER_ROOTS.has(current.name)
}

function isSizeIdentifier(node) {
  return node?.type === 'Identifier' && SIZE_IDENTIFIERS.has(node.name)
}

function calleeName(node) {
  if (node?.type === 'Identifier') return node.name
  if (node?.type === 'MemberExpression') return node.property?.name ?? ''
  return ''
}

function isHardcodedSize(valueNode) {
  if (!valueNode) return false
  if (isTokenMember(valueNode)) return false
  if (isSizeIdentifier(valueNode)) return false
  if (valueNode.type === 'Literal') {
    if (typeof valueNode.value === 'number') return valueNode.value !== 0
    if (typeof valueNode.value === 'string') {
      const text = valueNode.value.trim()
      if (text === '0') return false
      if (/^var\(/i.test(text)) return false
      return HARDCODED_PX.test(text) || HARDCODED_BARE.test(text)
    }
    return false
  }
  if (valueNode.type === 'ConditionalExpression') {
    return isHardcodedSize(valueNode.consequent) || isHardcodedSize(valueNode.alternate)
  }
  if (valueNode.type === 'LogicalExpression') {
    return isHardcodedSize(valueNode.left) || isHardcodedSize(valueNode.right)
  }
  if (
    valueNode.type === 'BinaryExpression' &&
    (valueNode.operator === '*' || valueNode.operator === '+' || valueNode.operator === '-')
  ) {
    if (isSizeIdentifier(valueNode.left) || isSizeIdentifier(valueNode.right)) return false
    return isHardcodedSize(valueNode.left) || isHardcodedSize(valueNode.right)
  }
  if (valueNode.type === 'CallExpression') {
    const name = calleeName(valueNode.callee)
    if (MATH_ROUNDERS.has(name) || name === 'Number') {
      return (valueNode.arguments || []).some((arg) => isHardcodedSize(arg))
    }
    return false
  }
  if (valueNode.type === 'TemplateLiteral') {
    if ((valueNode.quasis || []).some((quasi) => HARDCODED_PX.test(quasi.value?.raw ?? ''))) {
      return true
    }
    return (valueNode.expressions || []).some((expr) => isHardcodedSize(expr))
  }
  return false
}

function jsxElementOfStyleProp(propertyNode) {
  let current = propertyNode.parent
  while (current) {
    if (current.type === 'JSXElement') return current
    current = current.parent
  }
  return null
}

function expressionHasEmoji(node) {
  if (!node) return false
  if (node.type === 'Literal' && typeof node.value === 'string' && !LETTERS.test(node.value)) {
    return node.value.length > 0 && node.value.length <= 4
  }
  if (node.type === 'MemberExpression' && node.property?.name === 'emoji') return true
  if (node.type === 'LogicalExpression' || node.type === 'ConditionalExpression') {
    return (
      expressionHasEmoji(node.left) ||
      expressionHasEmoji(node.right) ||
      expressionHasEmoji(node.consequent) ||
      expressionHasEmoji(node.alternate)
    )
  }
  return false
}

function isShortGlyphText(jsxElement) {
  if (!jsxElement?.children) return false
  const texts = jsxElement.children
    .filter((child) => child.type === 'JSXText')
    .map((child) => child.value.replace(/\s+/g, ''))
    .filter(Boolean)
  if (texts.length === 1) {
    const text = texts[0]
    if (text.length <= 4 && !LETTERS.test(text)) return true
  }
  return jsxElement.children.some(
    (child) => child.type === 'JSXExpressionContainer' && expressionHasEmoji(child.expression)
  )
}

export default {
  meta: {
    type: 'problem',
    docs: {
      description: '禁止业务代码写死字号，必须引用主题 token',
      recommended: true
    },
    messages: {
      hardcoded: MESSAGE
    },
    schema: []
  },

  create(context) {
    const filename = context.filename ?? context.getFilename?.() ?? ''
    if (isExemptFile(filename)) return {}

    return {
      Property(node) {
        if (keyName(node.key) !== 'fontSize') return
        if (!isHardcodedSize(node.value)) return
        if (isGlyphKey(enclosingStyleKey(node))) return
        const jsx = jsxElementOfStyleProp(node)
        if (jsx && isShortGlyphText(jsx)) return
        context.report({ node: node.value, messageId: 'hardcoded' })
      },
      TemplateElement(node) {
        if (TEMPLATE_FONT_SIZE_PX.test(node.value.raw)) {
          context.report({ node, messageId: 'hardcoded' })
        }
      }
    }
  }
}
