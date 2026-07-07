#!/usr/bin/env node
/**
 * 将 logger / console 参数中的 i18n.t() / t() 还原为普通字符串字面量。
 * 用法：node scripts/revert-log-i18n.mjs [--dry-run]
 */
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const ROOT = path.resolve(import.meta.dirname, '..')
const DRY_RUN = process.argv.includes('--dry-run')

const SCAN_ROOTS = [
  path.join(ROOT, 'apps/desktop/src'),
  path.join(ROOT, 'apps/mobile'),
  path.join(ROOT, 'packages')
]

const LOG_METHODS = new Set(['log', 'info', 'warn', 'error', 'debug', 'trace'])
const SKIP_DIRS = new Set(['node_modules', 'dist', 'out', 'build', '.turbo', 'coverage'])

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

/** @param {ts.Node} node @returns {boolean} */
function isTranslateCall(node) {
  if (!ts.isCallExpression(node)) return false
  const callee = node.expression
  if (ts.isIdentifier(callee) && callee.text === 't') return true
  if (
    ts.isPropertyAccessExpression(callee) &&
    callee.name.text === 't' &&
    ts.isIdentifier(callee.expression) &&
    callee.expression.text === 'i18n'
  ) {
    return true
  }
  return false
}

/** @param {ts.CallExpression} node @returns {boolean} */
function isLoggerOrConsoleCall(node) {
  if (!ts.isPropertyAccessExpression(node.expression)) return false
  const obj = node.expression.expression
  const method = node.expression.name.text
  if (!ts.isIdentifier(obj)) return false
  if (!['logger', 'console'].includes(obj.text)) return false
  return LOG_METHODS.has(method)
}

/** @param {ts.CallExpression} node @param {ts.SourceFile} sf */
function unwrapTranslateText(node, sf) {
  const args = node.arguments
  if (args.length >= 2) return args[1].getText(sf)
  if (args.length === 1) return args[0].getText(sf)
  return null
}

/** @param {string} text */
function removeUnusedI18nImport(text) {
  if (!/\bi18n\b/.test(text)) return text
  const withoutDefault = text.replace(/^import i18n from 'i18next'\n/m, '')
  if (withoutDefault !== text) return withoutDefault
  return text.replace(
    /import\s+\{([^}]*)\}\s+from\s+['"]i18next['"]\n/m,
    (_match, inner) => {
      const names = inner
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s && s !== 'i18n')
      if (names.length === 0) return ''
      return `import { ${names.join(', ')} } from 'i18next'\n`
    }
  )
}

/** @param {string} filePath */
function revertFile(filePath) {
  const text = fs.readFileSync(filePath, 'utf8')
  const kind = filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  const sf = ts.createSourceFile(filePath, text, ts.ScriptTarget.Latest, true, kind)

  /** @type {{ start: number, end: number, replacement: string }[]} */
  const edits = []

  /** @param {ts.Node} node */
  function visit(node) {
    if (ts.isCallExpression(node) && isLoggerOrConsoleCall(node)) {
      for (const arg of node.arguments) {
        if (isTranslateCall(arg)) {
          const replacement = unwrapTranslateText(arg, sf)
          if (replacement) {
            edits.push({
              start: arg.getStart(sf, false),
              end: arg.getEnd(),
              replacement
            })
          }
        }
      }
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

  if (!/\bi18n\.t\s*\(/.test(next) && !/\bt\s*\(\s*['"`]auto\./.test(next)) {
    next = removeUnusedI18nImport(next)
  }

  if (!DRY_RUN) fs.writeFileSync(filePath, next, 'utf8')
  return edits.length
}

let total = 0
let fileCount = 0
for (const root of SCAN_ROOTS) {
  for (const file of collectSourceFiles(root)) {
    const n = revertFile(file)
    if (n > 0) {
      total += n
      fileCount += 1
      if (DRY_RUN) console.log(`[dry-run] ${path.relative(ROOT, file)}: ${n}`)
    }
  }
}

console.log(
  DRY_RUN
    ? `Would revert ${total} log i18n wrappers in ${fileCount} files`
    : `Reverted ${total} log i18n wrappers in ${fileCount} files`
)
