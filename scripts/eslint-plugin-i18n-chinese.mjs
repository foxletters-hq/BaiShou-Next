/**
 * ESLint自定义规则：检测硬编码的中文字符
 *
 * 规则说明：
 * - 检测用户可见文案中的硬编码中文（需走 t() / i18n.t()）
 * - 忽略 logger / console 日志
 * - 忽略测试文件
 * - 忽略注释、import、t() 默认值参数
 */

const CHINESE_REGEX = /[\u4e00-\u9fa5]/
const LOG_METHODS = new Set(['log', 'info', 'warn', 'error', 'debug', 'trace'])

/** @param {string} filename */
function isTestFile(filename) {
  const normalized = filename.replace(/\\/g, '/')
  return (
    /(?:^|\/)(?:__tests__|tests)(?:\/|$)/.test(normalized) ||
    /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(normalized)
  )
}

export default {
  meta: {
    type: 'suggestion',
    docs: {
      description: '检测未使用i18n的硬编码中文字符',
      category: 'Internationalization',
      recommended: true
    },
    messages: {
      hardcodedChinese: '发现硬编码中文 "{{text}}"，请使用 t() 函数进行国际化。'
    },
    schema: []
  },

  create(context) {
    const filename = context.filename ?? context.getFilename?.() ?? ''
    if (isTestFile(filename)) {
      return {}
    }

    const sourceCode = context.sourceCode ?? context.getSourceCode()

    function isInsideTCall(node) {
      let parent = node.parent
      while (parent) {
        if (
          parent.type === 'CallExpression' &&
          parent.callee &&
          (parent.callee.name === 't' ||
            (parent.callee.type === 'MemberExpression' && parent.callee.property?.name === 't'))
        ) {
          return true
        }
        if (parent.type === 'JSXExpressionContainer') {
          return false
        }
        parent = parent.parent
      }
      return false
    }

    function isInsideLoggerOrConsoleCall(node) {
      let parent = node.parent
      while (parent) {
        if (parent.type === 'CallExpression' && parent.callee?.type === 'MemberExpression') {
          const object = parent.callee.object
          const method = parent.callee.property?.name
          if (
            object?.type === 'Identifier' &&
            (object.name === 'logger' || object.name === 'console') &&
            LOG_METHODS.has(method)
          ) {
            return true
          }
        }
        parent = parent.parent
      }
      return false
    }

    function isImportDeclaration(node) {
      return node.parent?.type === 'ImportDeclaration'
    }

    return {
      Literal(node) {
        if (typeof node.value !== 'string') return
        if (!CHINESE_REGEX.test(node.value)) return
        if (isInsideTCall(node)) return
        if (isInsideLoggerOrConsoleCall(node)) return
        if (isImportDeclaration(node)) return

        const comments = sourceCode.getCommentsBefore(node)
        const isComment = comments.some(
          (c) => c.value.includes(node.value) || node.value.includes(c.value)
        )
        if (isComment) return

        context.report({
          node,
          messageId: 'hardcodedChinese',
          data: {
            text: node.value.substring(0, 20) + (node.value.length > 20 ? '...' : '')
          }
        })
      },

      JSXText(node) {
        const text = node.value.trim()
        if (!text) return
        if (!CHINESE_REGEX.test(text)) return

        context.report({
          node,
          messageId: 'hardcodedChinese',
          data: {
            text: text.substring(0, 20) + (text.length > 20 ? '...' : '')
          }
        })
      },

      TemplateLiteral(node) {
        if (isInsideTCall(node)) return
        if (isInsideLoggerOrConsoleCall(node)) return

        const text = node.quasis.map((q) => q.value.raw).join('')
        if (!CHINESE_REGEX.test(text)) return

        const parent = node.parent
        if (parent?.type === 'JSXExpressionContainer') {
          context.report({
            node,
            messageId: 'hardcodedChinese',
            data: {
              text: text.substring(0, 20) + (text.length > 20 ? '...' : '')
            }
          })
        }
      }
    }
  }
}
