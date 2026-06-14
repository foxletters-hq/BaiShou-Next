#!/usr/bin/env node
/**
 * 扫描「不稳定 effect 依赖」风险：易导致 useFocusEffect / useEffect 无限循环。
 *
 * 检测项：
 * 1. custom hook 返回未 useCallback 包装的函数（refresh/load/fetch/handle 等）
 * 2. useFocusEffect / useEffect 依赖上述高风险函数名
 * 3. useCallback/useEffect 依赖整个 services 对象（应拆成 services?.xxx）
 */
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const ROOT = path.resolve(import.meta.dirname, '..')
const DEFAULT_TARGETS = [path.join(ROOT, 'apps/mobile/src')]

const HOOK_NAME_RE = /^use[A-Z]/
const RISKY_FN_NAME_RE = /^(refresh|load|fetch|reload|sync|handle)[A-Z]\w*$/
const SKIP_DIRS = new Set(['node_modules', 'dist', '.expo', 'android', 'ios', 'build', 'coverage'])

/** @typedef {{ file: string, line: number, rule: string, name?: string, message: string, severity: 'error' | 'warn' }} Finding */

/** @param {string} dir @returns {string[]} */
function collectSourceFiles(dir) {
  /** @type {string[]} */
  const files = []
  if (!fs.existsSync(dir)) return files

  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(ent.name)) continue
    const full = path.join(dir, ent.name)
    if (ent.isDirectory()) files.push(...collectSourceFiles(full))
    else if (/\.(ts|tsx)$/.test(ent.name) && !ent.name.endsWith('.d.ts')) files.push(full)
  }
  return files
}

/** @param {ts.Node} node */
function getLine(sf, node) {
  const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf))
  return line + 1
}

/** @param {ts.Node} node @returns {string | null} */
function getIdentifierName(node) {
  if (ts.isIdentifier(node)) return node.text
  return null
}

/** @param {ts.Expression} init */
function isUseCallbackCall(init) {
  return (
    ts.isCallExpression(init) &&
    ts.isIdentifier(init.expression) &&
    init.expression.text === 'useCallback'
  )
}

/** @param {ts.Expression} init */
function isAsyncOrFnExpression(init) {
  return ts.isArrowFunction(init) || ts.isFunctionExpression(init)
}

/** @param {ts.Node} node @returns {boolean} */
function isInsideHookFunction(node) {
  let current = node.parent
  while (current) {
    if (
      ts.isFunctionDeclaration(current) &&
      current.name &&
      HOOK_NAME_RE.test(current.name.text)
    ) {
      return true
    }
    if (
      ts.isVariableDeclaration(current) &&
      current.name &&
      ts.isIdentifier(current.name) &&
      HOOK_NAME_RE.test(current.name.text) &&
      current.parent &&
      ts.isVariableStatement(current.parent)
    ) {
      return true
    }
    current = current.parent
  }
  return false
}

/** @param {ts.ReturnStatement} ret */
function getReturnedPropertyNames(ret) {
  /** @type {Set<string>} */
  const names = new Set()
  const expr = ret.expression
  if (!expr) return names

  if (ts.isObjectLiteralExpression(expr)) {
    for (const prop of expr.properties) {
      if (ts.isShorthandPropertyAssignment(prop) && ts.isIdentifier(prop.name)) {
        names.add(prop.name.text)
      } else if (ts.isPropertyAssignment(prop)) {
        if (ts.isIdentifier(prop.name)) names.add(prop.name.text)
        else if (ts.isStringLiteral(prop.name)) names.add(prop.name.text)
        // refreshData: fetchData → 属性名也算暴露
        if (ts.isIdentifier(prop.name)) names.add(prop.name.text)
      }
    }
  }
  return names
}

/** @param {ts.SourceFile} sf @param {ts.Node} root */
function collectReturnedNamesFromHook(root) {
  /** @type {Set<string>} */
  const names = new Set()
  const visit = (node) => {
    if (ts.isReturnStatement(node)) {
      for (const n of getReturnedPropertyNames(node)) names.add(n)
    }
    ts.forEachChild(node, visit)
  }
  visit(root)
  return names
}

/** @param {ts.ArrayLiteralExpression} deps */
function getDepIdentifiers(deps) {
  /** @type {string[]} */
  const ids = []
  for (const el of deps.elements) {
    const name = getIdentifierName(el)
    if (name) ids.push(name)
    if (ts.isPropertyAccessExpression(el) && ts.isIdentifier(el.expression)) {
      ids.push(`${el.expression.text}.${el.name.text}`)
    }
  }
  return ids
}

/** @param {string} file @returns {Finding[]} */
function analyzeFile(file) {
  const text = fs.readFileSync(file, 'utf8')
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  /** @type {Finding[]} */
  const findings = []
  /** @type {Map<string, { memoized: boolean, line: number }>} */
  const localFns = new Map()
  /** @type {Set<string>} */
  const returnedNames = new Set()

  const visitHooks = (node) => {
    const isHookFn =
      (ts.isFunctionDeclaration(node) && node.name && HOOK_NAME_RE.test(node.name.text)) ||
      (ts.isArrowFunction(node) &&
        node.parent &&
        ts.isVariableDeclaration(node.parent) &&
        ts.isIdentifier(node.parent.name) &&
        HOOK_NAME_RE.test(node.parent.name.text))

    if (isHookFn) {
      const hookBody = ts.isFunctionDeclaration(node) ? node : node
      for (const n of collectReturnedNamesFromHook(hookBody)) returnedNames.add(n)
    }
    ts.forEachChild(node, visitHooks)
  }
  visitHooks(sf)

  const visit = (node) => {
    // Rule 1: unmemoized function returned from hook
    if (
      ts.isVariableDeclaration(node) &&
      node.initializer &&
      ts.isIdentifier(node.name) &&
      isAsyncOrFnExpression(node.initializer) &&
      !isUseCallbackCall(node.initializer) &&
      isInsideHookFunction(node)
    ) {
      const name = node.name.text
      const memoized = false
      localFns.set(name, { memoized, line: getLine(sf, node) })

      if (returnedNames.has(name) && RISKY_FN_NAME_RE.test(name)) {
        findings.push({
          file,
          line: getLine(sf, node),
          rule: 'unmemoized-hook-export',
          name,
          severity: 'error',
          message: `Hook 将未 useCallback 的函数「${name}」暴露给外部，若被放入 useEffect/useFocusEffect 依赖可能无限循环`
        })
      } else if (!returnedNames.has(name) && RISKY_FN_NAME_RE.test(name)) {
        findings.push({
          file,
          line: getLine(sf, node),
          rule: 'unmemoized-hook-export',
          name,
          severity: 'warn',
          message: `Hook 内未 memo 的函数「${name}」命名像 effect 回调，建议 useCallback 或不要 return`
        })
      }
    }

    // Rule 1b: shorthand return { foo } where foo is unmemoized arrow in hook
    if (
      ts.isVariableDeclaration(node) &&
      node.initializer &&
      ts.isIdentifier(node.name) &&
      isUseCallbackCall(node.initializer)
    ) {
      localFns.set(node.name.text, { memoized: true, line: getLine(sf, node) })
    }

    // Rule 2: useFocusEffect / useEffect with risky deps
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      const callee = node.expression.text
      if (callee === 'useFocusEffect' || callee === 'useEffect') {
        const cb = node.arguments[0]
        let deps = /** @type {ts.ArrayLiteralExpression | null} */ (null)

        if (cb && ts.isCallExpression(cb) && ts.isIdentifier(cb.expression) && cb.expression.text === 'useCallback') {
          const depArg = cb.arguments[1]
          if (depArg && ts.isArrayLiteralExpression(depArg)) deps = depArg
        } else if (node.arguments[1] && ts.isArrayLiteralExpression(node.arguments[1])) {
          deps = node.arguments[1]
        }

        if (deps) {
          for (const dep of getDepIdentifiers(deps)) {
            const bare = dep.split('.')[0]
            if (RISKY_FN_NAME_RE.test(bare)) {
              findings.push({
                file,
                line: getLine(sf, deps),
                rule: 'risky-effect-dep',
                name: bare,
                severity: 'warn',
                message: `${callee} 依赖「${bare}」：请确认该函数引用稳定（useCallback 或 alias 到 fetchData）`
              })
            }
            if (bare === 'services' && !dep.includes('?.')) {
              findings.push({
                file,
                line: getLine(sf, deps),
                rule: 'whole-services-dep',
                name: 'services',
                severity: 'warn',
                message: `${callee} 依赖整个 services 对象，Provider 更新时可能意外重跑；建议 services?.xxx 或 vaultRevision`
              })
            }
          }
        }
      }
    }

    ts.forEachChild(node, visit)
  }

  visit(sf)
  return findings
}

function main() {
  const args = process.argv.slice(2)
  const targets = args.length > 0 ? args.map((p) => path.resolve(ROOT, p)) : DEFAULT_TARGETS

  /** @type {Finding[]} */
  const all = []
  for (const target of targets) {
    for (const file of collectSourceFiles(target)) {
      all.push(...analyzeFile(file))
    }
  }

  const rel = (f) => path.relative(ROOT, f).replace(/\\/g, '/')
  const errors = all.filter((f) => f.severity === 'error')
  const warns = all.filter((f) => f.severity === 'warn')

  if (all.length === 0) {
    console.log('✓ 未发现不稳定 effect 依赖风险')
    process.exit(0)
  }

  console.log(`扫描完成：${errors.length} error，${warns.length} warn\n`)

  for (const f of [...errors, ...warns]) {
    const tag = f.severity === 'error' ? 'ERROR' : 'WARN '
    console.log(`${tag}  ${rel(f.file)}:${f.line}  [${f.rule}]  ${f.message}`)
  }

  console.log('\n说明：error = hook 明确 return 了未 memo 函数；warn = 需人工确认')
  process.exit(errors.length > 0 ? 1 : 0)
}

main()
