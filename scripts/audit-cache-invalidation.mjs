#!/usr/bin/env node
/**
 * 缓存失效规范审计：禁止在 UI/业务层直接调用底层 invalidate/clear，
 * 必须通过 DomainMutationBus → CacheCoordinator → globalCacheRegistry。
 *
 * 允许直接调用底层 API 的路径见 ALLOWLIST_PATH_RE。
 */
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const ROOT = path.resolve(import.meta.dirname, '..')

const SCAN_ROOTS = [
  path.join(ROOT, 'apps/mobile/src'),
  path.join(ROOT, 'apps/desktop/src'),
  path.join(ROOT, 'packages/core/src'),
  path.join(ROOT, 'packages/ui/src')
]

/** 仅在这些路径内允许出现 forbidden 标识符 */
const ALLOWLIST_PATH_RE =
  /(?:register-(?:mobile|desktop-main|desktop-renderer)-cache-stores|[-/]cache\/(?:mobile|desktop-(?:main|renderer))-cache-coordinator|summary\.ipc|vault\.ipc|archive\.service|summary-dashboard-cache|user-avatar-display\.util|assistant-avatar-display\.util|mobile-mcp-context\.service|agent-helpers\.ts|mobile-attachment-image-cache|chat-attachment-thumbnail\.util|tts-synthesis-cache|mimo-tts\.util|mobile-tts-settings\.service|useAttachmentImageLoader|useChatMessages|__tests__|\.test\.|\.spec\.)/

const FORBIDDEN_IDENTIFIERS = new Set([
  'invalidateSummaryDashboardCache',
  'clearSummaryDashboardCache',
  'invalidateUserAvatarDisplayCache',
  'invalidateAssistantAvatarDisplayCache',
  'invalidateAllAvatarDisplayCaches',
  'invalidateMobileMcpToolContextCache',
  'invalidateMcpToolContextCache',
  'clearAllAttachmentImageCaches',
  'clearChatAttachmentImageCaches',
  'clearGlobalTtsSynthesisCache',
  'clearMimoRefAudioHydrationCache',
  'resetCachedManager'
])

const SKIP_DIRS = new Set(['node_modules', 'dist', 'out', 'build', '.turbo', 'coverage'])

/** @typedef {{ file: string, line: number, id: string, kind: 'import' | 'call' }} Violation */

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

/** @param {string} filePath */
function isAllowlisted(filePath) {
  const rel = path.relative(ROOT, filePath).replace(/\\/g, '/')
  return ALLOWLIST_PATH_RE.test(rel)
}

/** @param {string} filePath @returns {Violation[]} */
function scanFile(filePath) {
  if (isAllowlisted(filePath)) return []

  const text = fs.readFileSync(filePath, 'utf8')
  const sf = ts.createSourceFile(
    filePath,
    text,
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  )
  /** @type {Violation[]} */
  const violations = []

  /** @param {ts.Node} node */
  function visit(node) {
    if (
      ts.isImportDeclaration(node) &&
      node.importClause?.namedBindings &&
      ts.isNamedImports(node.importClause.namedBindings)
    ) {
      for (const el of node.importClause.namedBindings.elements) {
        const name = el.name.text
        if (FORBIDDEN_IDENTIFIERS.has(name)) {
          const { line } = sf.getLineAndCharacterOfPosition(el.getStart(sf))
          violations.push({ file: filePath, line: line + 1, id: name, kind: 'import' })
        }
      }
    }

    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      FORBIDDEN_IDENTIFIERS.has(node.expression.text)
    ) {
      const { line } = sf.getLineAndCharacterOfPosition(node.expression.getStart(sf))
      violations.push({ file: filePath, line: line + 1, id: node.expression.text, kind: 'call' })
    }

    ts.forEachChild(node, visit)
  }

  visit(sf)
  return violations
}

function main() {
  /** @type {Violation[]} */
  const all = []
  for (const root of SCAN_ROOTS) {
    for (const file of collectSourceFiles(root)) {
      all.push(...scanFile(file))
    }
  }

  if (all.length === 0) {
    console.log('[audit-cache-invalidation] OK — 未发现绕过 CacheCoordinator 的失效调用。')
    process.exit(0)
  }

  console.error(
    '[audit-cache-invalidation] 发现违规：请改用 emitDomainMutation / emitSyncMutation / Core 写路径。\n'
  )
  for (const v of all) {
    const rel = path.relative(ROOT, v.file).replace(/\\/g, '/')
    console.error(`  ${rel}:${v.line}  ${v.kind} ${v.id}`)
  }
  console.error(`\n共 ${all.length} 处。允许名单见 scripts/audit-cache-invalidation.mjs`)
  process.exit(1)
}

main()
