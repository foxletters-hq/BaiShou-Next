#!/usr/bin/env node
/**
 * 批量将硬编码中文包裹为 i18n.t() / t()，消除 i18n-chinese/no-hardcoded-chinese warning。
 * 用法：node scripts/fix-i18n-hardcoded-chinese.mjs [--dry-run]
 */
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const ROOT = path.resolve(import.meta.dirname, '..')
const DRY_RUN = process.argv.includes('--dry-run')

const SCAN_ROOTS = [
  path.join(ROOT, 'apps/desktop/src'),
  path.join(ROOT, 'apps/mobile'),
  path.join(ROOT, 'packages/ui/src'),
  path.join(ROOT, 'packages/core/src')
]

const CHINESE_REGEX = /[\u4e00-\u9fa5]/
const SKIP_DIRS = new Set(['node_modules', 'dist', 'out', 'build', '.turbo', 'coverage'])
const LOG_METHODS = new Set(['log', 'info', 'warn', 'error', 'debug', 'trace'])

/** @param {string} filePath */
function isTestFile(filePath) {
  const normalized = filePath.replace(/\\/g, '/')
  return (
    /(?:^|\/)(?:__tests__|tests)(?:\/|$)/.test(normalized) ||
    /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(normalized)
  )
}

/** @param {ts.Node} node @returns {boolean} */
function isInsideLoggerOrConsoleCall(node) {
  let parent = node.parent
  while (parent) {
    if (ts.isCallExpression(parent) && ts.isPropertyAccessExpression(parent.expression)) {
      const obj = parent.expression.expression
      const method = parent.expression.name.text
      if (
        ts.isIdentifier(obj) &&
        (obj.text === 'logger' || obj.text === 'console') &&
        LOG_METHODS.has(method)
      ) {
        return true
      }
    }
    parent = parent.parent
  }
  return false
}

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

/** @param {string} rel @param {number} line */
function makeKey(rel, line) {
  const base = rel
    .replace(/\\/g, '/')
    .replace(/\.(tsx?|jsx?)$/, '')
    .replace(/[^a-zA-Z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '')
  return `auto.${base}.L${line}`
}

/** @param {string} text */
function escapeForQuote(text, quote) {
  if (quote === "'") return text.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
  return text.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

/** @param {ts.Node} node @returns {boolean} */
function isInsideTCall(node) {
  let parent = node.parent
  while (parent) {
    if (ts.isCallExpression(parent)) {
      const callee = parent.expression
      if (ts.isIdentifier(callee) && callee.text === 't') return true
      if (
        ts.isPropertyAccessExpression(callee) &&
        callee.name.text === 't' &&
        (ts.isIdentifier(callee.expression) ||
          (ts.isPropertyAccessExpression(callee.expression) &&
            callee.expression.name.text === 'i18n'))
      ) {
        return true
      }
    }
    if (ts.isJsxExpression(parent)) return false
    parent = parent.parent
  }
  return false
}

/** @param {ts.Node} node */
function isImportLiteral(node) {
  let parent = node.parent
  while (parent) {
    if (ts.isImportDeclaration(parent) || ts.isExportDeclaration(parent)) return true
    parent = parent.parent
  }
  return false
}

/** @param {ts.Node} node @returns {boolean} */
function isJsxAttributeValue(node) {
  const parent = node.parent
  return ts.isJsxAttribute(parent) && parent.initializer === node
}

/**
 * @param {string} source
 * @returns {'t' | 'i18n.t'}
 */
function pickTranslator(source) {
  if (/useTranslation\s*\(/.test(source) && /\bconst\s*\{[^}]*\bt\b/.test(source)) {
    return 't'
  }
  return 'i18n.t'
}

/** @typedef {{ start: number, end: number, replacement: string }} Edit */

/** @param {string} filePath */
function fixFile(filePath) {
  if (isTestFile(filePath)) return 0

  const text = fs.readFileSync(filePath, 'utf8')
  const rel = path.relative(ROOT, filePath)
  const kind = filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  const sf = ts.createSourceFile(filePath, text, ts.ScriptTarget.Latest, true, kind)
  const translator = pickTranslator(text)
  /** @type {Edit[]} */
  const edits = []

  /** @param {ts.Node} node @param {string} replacement */
  function pushEdit(node, replacement) {
    const start = node.getStart(sf, false)
    const end = node.getEnd()
    if (replacement === text.slice(start, end)) return
    edits.push({ start, end, replacement })
  }

  /** @param {ts.Node} node */
  function visit(node) {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      const value = node.text
      if (!CHINESE_REGEX.test(value)) return
      if (isInsideTCall(node)) return
      if (isInsideLoggerOrConsoleCall(node)) return
      if (isImportLiteral(node)) return
      if (node.parent && (node.parent.name === node || node.parent.tagName === node)) return

      const line = sf.getLineAndCharacterOfPosition(node.getStart(sf, false)).line + 1
      const key = makeKey(rel, line)
      const raw = node.getText(sf)
      const wrapped = `${translator}('${key}', ${raw})`
      if (isJsxAttributeValue(node)) {
        pushEdit(node, `{${wrapped}}`)
      } else {
        pushEdit(node, wrapped)
      }
    }

    if (ts.isJsxText(node)) {
      const trimmed = node.text.trim()
      if (!trimmed || !CHINESE_REGEX.test(trimmed)) return
      const line = sf.getLineAndCharacterOfPosition(node.getStart(sf, false)).line + 1
      const key = makeKey(rel, line)
      const quote = trimmed.includes("'") ? '"' : "'"
      const escaped = escapeForQuote(trimmed, quote)
      pushEdit(node, `{${translator}('${key}', ${quote}${escaped}${quote})}`)
    }

    if (ts.isTemplateExpression(node)) {
      const rawText = node.getText(sf)
      if (!CHINESE_REGEX.test(rawText)) return
      if (isInsideTCall(node)) return
      if (isInsideLoggerOrConsoleCall(node)) return
      const parent = node.parent
      if (!ts.isJsxExpression(parent)) return
      const line = sf.getLineAndCharacterOfPosition(node.getStart(sf, false)).line + 1
      const key = makeKey(rel, line)
      pushEdit(node, `${translator}('${key}', ${rawText})`)
    }

    ts.forEachChild(node, visit)
  }

  visit(sf)

  if (edits.length === 0) return 0

  edits.sort((a, b) => b.start - a.start)
  let next = text
  for (const edit of edits) {
    next = next.slice(0, edit.start) + edit.replacement + next.slice(edit.end)
  }

  const needsI18nImport =
    translator === 'i18n.t' &&
    !/import\s+(?:\w+\s*,\s*)?\{[^}]*\bi18n\b[^}]*\}\s+from|import\s+i18n\s+from/.test(next)

  if (needsI18nImport) {
    const importLine = "import i18n from 'i18next'\n"
    const firstImport = next.match(/^import\s/m)
    if (firstImport && firstImport.index != null) {
      next = next.slice(0, firstImport.index) + importLine + next.slice(firstImport.index)
    } else {
      next = importLine + next
    }
  }

  if (!DRY_RUN) fs.writeFileSync(filePath, next, 'utf8')
  return edits.length
}

let total = 0
let fileCount = 0
for (const root of SCAN_ROOTS) {
  for (const file of collectSourceFiles(root)) {
    const n = fixFile(file)
    if (n > 0) {
      total += n
      fileCount += 1
    }
  }
}

console.log(
  DRY_RUN
    ? `Would fix ${total} literals in ${fileCount} files`
    : `Fixed ${total} literals in ${fileCount} files`
)
