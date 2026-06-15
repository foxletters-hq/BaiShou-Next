#!/usr/bin/env node
/**
 * 从 apps/desktop/resources/database/drizzle 同步生成
 * packages/database/src/embedded-agent-migrations.ts（供移动端内嵌迁移）
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const drizzleDir = join(root, 'apps/desktop/resources/database/drizzle')
const journalPath = join(drizzleDir, 'meta/_journal.json')
const outPath = join(root, 'packages/database/src/embedded-agent-migrations.ts')

function escapeTemplateLiteral(value) {
  return value.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${')
}

function main() {
  if (!existsSync(journalPath)) {
    throw new Error(`缺少迁移日志：${journalPath}`)
  }

  const journal = JSON.parse(readFileSync(journalPath, 'utf8'))
  const sqlByTag = {}

  for (const entry of journal.entries) {
    const sqlPath = join(drizzleDir, `${entry.tag}.sql`)
    if (!existsSync(sqlPath)) {
      throw new Error(`缺少迁移 SQL：${sqlPath}`)
    }
    sqlByTag[entry.tag] = readFileSync(sqlPath, 'utf8').trimEnd()
  }

  const extraSql = readdirSync(drizzleDir).filter(
    (name) => name.endsWith('.sql') && !sqlByTag[name.replace(/\.sql$/, '')]
  )
  if (extraSql.length > 0) {
    throw new Error(`存在未登记在 _journal.json 的 SQL 文件：${extraSql.join(', ')}`)
  }

  const sqlEntries = journal.entries
    .map((entry) => `    '${entry.tag}': \`${escapeTemplateLiteral(sqlByTag[entry.tag])}\``)
    .join(',\n')

  const content = `import type { EmbeddedMigrations } from './migration.service'

/**
 * Agent DB 迁移（内嵌，供 Expo / React Native 使用，不依赖文件系统读取 drizzle 目录）
 * 由 scripts/sync-embedded-agent-migrations.mjs 根据 apps/desktop/resources/database/drizzle 自动生成
 */
export const EMBEDDED_AGENT_MIGRATIONS: EmbeddedMigrations = {
  journal: ${JSON.stringify(journal, null, 2).replaceAll('\n', '\n  ')},
  sqlByTag: {
${sqlEntries}
  }
}
`

  writeFileSync(outPath, content, 'utf8')
  console.log(`[sync-embedded-agent-migrations] 已写入 ${outPath}`)
}

main()
