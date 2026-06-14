/**
 * ESLint：拦截 custom hook 中「未 memo 就 return 的函数」。
 *
 * 能拦住本次 Summary bug 的主因，但无法覆盖：
 * - useCallback 依赖了不稳定的 services 大对象
 * - 父组件内联箭头函数传入 effect
 */
const HOOK_NAME_RE = /^use[A-Z]/
const RISKY_EXPORT_NAME_RE = /^(refresh|load|fetch|reload|sync)[A-Z]\w*$/

function collectReturnedNames(body) {
  /** @type {Set<string>} */
  const names = new Set()
  const visited = new WeakSet()

  /** @param {import('eslint').Rule.Node | null | undefined} node */
  const visit = (node) => {
    if (!node || typeof node !== 'object' || !('type' in node)) return
    if (visited.has(node)) return
    visited.add(node)

    if (node.type === 'ReturnStatement' && node.argument?.type === 'ObjectExpression') {
      for (const prop of node.argument.properties) {
        if (prop.type === 'Property' && prop.key.type === 'Identifier') {
          names.add(prop.key.name)
        }
      }
    }

    for (const key of Object.keys(node)) {
      if (key === 'parent' || key === 'range' || key === 'loc') continue
      const child = /** @type {unknown} */ (node[key])
      if (Array.isArray(child)) {
        for (const item of child) visit(item)
      } else {
        visit(child)
      }
    }
  }

  visit(body)
  return names
}

/** @param {import('eslint').Rule.Node} hookBody */
function findUnmemoizedExports(hookBody) {
  const returned = collectReturnedNames(hookBody)
  /** @type {Array<{ name: string, node: import('eslint').Rule.Node }>} */
  const violations = []
  const visited = new WeakSet()

  /** @param {import('eslint').Rule.Node | null | undefined} node */
  const visit = (node) => {
    if (!node || typeof node !== 'object' || !('type' in node)) return
    if (visited.has(node)) return
    visited.add(node)

    if (node.type === 'VariableDeclarator' && node.id?.type === 'Identifier' && node.init) {
      const name = node.id.name
      if (!returned.has(name)) {
        // continue into children only
      } else if (
        node.init.type === 'CallExpression' &&
        node.init.callee?.type === 'Identifier' &&
        node.init.callee.name === 'useCallback'
      ) {
        // ok
      } else if (
        node.init.type === 'ArrowFunctionExpression' ||
        node.init.type === 'FunctionExpression'
      ) {
        if (RISKY_EXPORT_NAME_RE.test(name)) {
          violations.push({ name, node: node.id })
        }
      }
    }

    for (const key of Object.keys(node)) {
      if (key === 'parent' || key === 'range' || key === 'loc') continue
      const child = /** @type {unknown} */ (node[key])
      if (Array.isArray(child)) {
        for (const item of child) visit(item)
      } else {
        visit(child)
      }
    }
  }

  visit(hookBody)
  return violations
}

export const stableHooksPlugin = {
  rules: {
    'no-unmemoized-hook-export': {
      meta: {
        type: 'problem',
        docs: {
          description:
            'Custom hook 不得 return 未 useCallback 包装的函数，否则 useFocusEffect 依赖会导致无限循环'
        },
        messages: {
          unmemoized:
            'Hook 将未 useCallback 的「{{name}}」暴露到 return，易被 useEffect/useFocusEffect 依赖引发无限更新'
        },
        schema: []
      },
      create(context) {
        return {
          'Program:exit'(program) {
            const visited = new WeakSet()

            /** @param {import('eslint').Rule.Node | null | undefined} node */
            const walk = (node) => {
              if (!node || typeof node !== 'object' || !('type' in node)) return
              if (visited.has(node)) return
              visited.add(node)

              if (node.type === 'FunctionDeclaration' && node.id && HOOK_NAME_RE.test(node.id.name)) {
                for (const v of findUnmemoizedExports(node.body)) {
                  context.report({
                    node: v.node,
                    messageId: 'unmemoized',
                    data: { name: v.name }
                  })
                }
              }

              if (
                node.type === 'VariableDeclarator' &&
                node.id?.type === 'Identifier' &&
                HOOK_NAME_RE.test(node.id.name) &&
                node.init &&
                (node.init.type === 'ArrowFunctionExpression' ||
                  node.init.type === 'FunctionExpression')
              ) {
                for (const v of findUnmemoizedExports(node.init.body)) {
                  context.report({
                    node: v.node,
                    messageId: 'unmemoized',
                    data: { name: v.name }
                  })
                }
              }

              for (const key of Object.keys(node)) {
                if (key === 'parent' || key === 'range' || key === 'loc') continue
                const child = /** @type {unknown} */ (node[key])
                if (Array.isArray(child)) {
                  for (const item of child) walk(item)
                } else {
                  walk(child)
                }
              }
            }

            walk(program)
          }
        }
      }
    }
  }
}

export default stableHooksPlugin
