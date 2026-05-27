import fs from 'fs'
import path from 'path'

/**
 * 旧版迁移集成测依赖外部 fixture 目录（体积大，不入库）。
 * 本地默认 `d:/Projects/test`；CI 无 fixture 时跳过。可通过环境变量覆盖：
 * `LEGACY_MIGRATION_FIXTURES_ROOT=/path/to/test`
 */
export function getLegacyMigrationFixturesRoot(): string {
  return process.env.LEGACY_MIGRATION_FIXTURES_ROOT ?? 'd:/Projects/test'
}

export function hasLegacyMigrationFixtures(): boolean {
  return fs.existsSync(path.join(getLegacyMigrationFixturesRoot(), 'cases', 'case1'))
}
