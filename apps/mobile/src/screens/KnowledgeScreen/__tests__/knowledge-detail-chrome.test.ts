import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const page = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'KnowledgeDetailScreen.tsx'),
  'utf8'
)

describe('mobile knowledge detail chrome', () => {
  it('should use native input and shared data-manage confirmation', () => {
    expect(page).toContain('canConfirmNotebookDataManage')
    expect(page).toContain('parseNotebookDataManageResult')
    expect(page).toContain('textarea')
    expect(page).not.toContain('TextInput')
    expect(page).not.toContain('Alert.alert')
    expect(page).toContain('mobileImportSource')
    expect(page).toContain('mobileManageNotebookData')
    expect(page).toContain('HelpTooltip')
    expect(page).toContain('knowledge.status_stored_help')
    expect(page).toContain('<Tooltip content={s.errorMessage.trim()}')
    expect(page).toContain('mobileDeleteSource')
    expect(page).toContain('knowledge.delete_source_confirm')
    expect(page).toContain('图关系和向量数据')
    expect(page).toContain('destructive: true')
  })
})
