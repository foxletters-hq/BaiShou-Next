import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))

describe('native StorageSettingsCard chrome', () => {
  it('parallelAction and fullAction styles should stretch and center (居中平放)', () => {
    const src = readFileSync(join(here, '../StorageSettingsCard.tsx'), 'utf8')
    expect(src).toContain('parallelRow: {')
    expect(src).toContain("flexDirection: 'row'")
    expect(src).toContain('parallelAction: {')
    expect(src).toContain('flex: 1')
    expect(src).toContain('fullAction: {')
    expect(src).toContain("alignSelf: 'stretch'")
    expect(src).toContain("justifyContent: 'center'")
  })

  it('migrateDirectory and changeDirectory buttons are parallel in parallelRow', () => {
    const src = readFileSync(join(here, '../StorageSettingsCard.tsx'), 'utf8')
    // onMigrateDirectory and onChangeDirectory should be rendered together inside parallelRow
    expect(src).toMatch(
      /onMigrateDirectory \|\| onChangeDirectory[\s\S]*?<View style=\{styles\.parallelRow\}>[\s\S]*?onMigrateDirectory[\s\S]*?onChangeDirectory/
    )
  })

  it('migrateFromFlutterLegacy button is rendered with fullAction (居中平放)', () => {
    const src = readFileSync(join(here, '../StorageSettingsCard.tsx'), 'utf8')
    expect(src).toMatch(/onMigrateFromFlutterLegacy[\s\S]*?style=\{styles\.fullAction\}/)
  })

  it('external journals and summaries buttons use parallelRow for parallel and center layout', () => {
    const src = readFileSync(join(here, '../StorageSettingsCard.tsx'), 'utf8')
    expect(src).toContain('onChangeExternalJournalsDirectory')
    expect(src).toContain('onChangeExternalSummariesDirectory')
  })
})
