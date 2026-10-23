/**
 * 桌面端：createPortal 出去的全屏遮罩必须裁到主内容胶囊。
 * 锚定菜单 / Tooltip / 拖拽预览 / 大图沉浸 不在此列，见 docs/1-AI-Code/2-UI-Theme-Rule.md §4.1。
 */

const RULE_NAME = 'portal-must-clip-to-content-card'

const MESSAGE =
  'createPortal 出去的全屏遮罩必须调用 withAppContentOverlay（或使用 Modal）。锚定菜单、Tooltip、拖拽预览、大图预览除外。见 docs/1-AI-Code/2-UI-Theme-Rule.md §4.1。'

/** 路径片段：这些文件的 portal 不是「盖住主内容卡的全屏 Dialog」 */
const EXEMPT_PATH_FRAGMENTS = [
  '/Tooltip/',
  '/ContextMenu/',
  'ChatBubbleContextMenu',
  'WorkbenchFileExplorerContextMenu',
  '/PageSizeSelector/',
  '/DiaryEditor/ImagePreview',
  'PendingEmbedNotice',
  'AIModelServicesProviderPane',
  '/AttachmentManagementView/AttachmentManagementView',
  '/AboutSettingsCard/'
]

function isExempt(filename) {
  const normalized = filename.replace(/\\/g, '/')
  if (/(?:^|\/)(?:__tests__|tests)(?:\/|$)/.test(normalized)) return true
  if (/\.(?:test|spec)\.[cm]?[jt]sx?$/.test(normalized)) return true
  return EXEMPT_PATH_FRAGMENTS.some((fragment) => normalized.includes(fragment))
}

function importNames(node) {
  const names = []
  for (const spec of node.specifiers || []) {
    if (spec.type === 'ImportSpecifier' && spec.imported) {
      names.push(spec.imported.name)
    } else if (spec.type === 'ImportDefaultSpecifier' && spec.local) {
      names.push(spec.local.name)
    }
  }
  return names
}

export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'createPortal 全屏遮罩必须裁到主内容胶囊',
      recommended: true
    },
    messages: {
      missingClip: MESSAGE
    },
    schema: []
  },

  create(context) {
    const filename = context.filename ?? context.getFilename?.() ?? ''
    if (!filename.endsWith('.tsx') || isExempt(filename)) return {}

    let usesPortal = false
    let clipsToCard = false

    return {
      ImportDeclaration(node) {
        const names = importNames(node)
        if (names.includes('withAppContentOverlay') || names.includes('Modal')) {
          clipsToCard = true
        }
      },
      CallExpression(node) {
        const callee = node.callee
        if (callee?.type === 'Identifier' && callee.name === 'createPortal') {
          usesPortal = true
        }
        if (
          callee?.type === 'MemberExpression' &&
          callee.property?.name === 'createPortal' &&
          callee.object?.name === 'ReactDOM'
        ) {
          usesPortal = true
        }
      },
      'Program:exit'() {
        if (usesPortal && !clipsToCard) {
          context.report({
            loc: { line: 1, column: 0 },
            messageId: 'missingClip'
          })
        }
      }
    }
  }
}

export { RULE_NAME }
