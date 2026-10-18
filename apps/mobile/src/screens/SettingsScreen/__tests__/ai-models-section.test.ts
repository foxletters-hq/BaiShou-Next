import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const sectionSource = readFileSync(join(here, '../components/AIModelsSection.tsx'), 'utf8')
const switcherSource = readFileSync(
  join(here, '../../../../../../packages/ui/src/native/ModelSwitcher/ModelSwitcher.tsx'),
  'utf8'
)

describe('AIModelsSection and ModelSwitcher integration', () => {
  it('should not contain conflicting handleEffortChange that overwrites selected model', () => {
    expect(sectionSource).not.toContain('const handleEffortChange')
    expect(sectionSource).not.toContain('onReasoningEffortChange')
  })

  it('should atomically update reasoning effort and model in handleSelectModel', () => {
    expect(sectionSource).toContain('effort?: ReasoningEffortSetting')
    expect(sectionSource).toContain('updatedReasoningEffort')
    expect(sectionSource).toContain('reasoningEffortBySlot: updatedReasoningEffort')
  })

  it('should fetch latest global_models config before persisting to avoid stale closures', () => {
    expect(sectionSource).toContain(
      "services.settingsManager.get<GlobalModelsConfig>('global_models')"
    )
  })

  it('should trigger detectDimension and enable RAG when embedding model is set', () => {
    expect(sectionSource).toContain('services.ragService.detectDimension()')
    expect(sectionSource).toContain('ragEnabled: true')
  })

  it('should show success toast after persisting models', () => {
    expect(sectionSource).toContain(
      "toast.showSuccess(t('settings.global_models_updated', '全局默认模型已更新'))"
    )
  })

  it('should pass reasoningEffort to onSelect in ModelSwitcher handleSave', () => {
    expect(switcherSource).toContain('onSelect(')
    expect(switcherSource).toContain('showReasoningPanel ? selectedEffort : undefined')
  })

  it('should accurately detect whether model is configured using configured checks', () => {
    expect(sectionSource).toContain('isConfiguredProviderId')
    expect(sectionSource).toContain('isConfiguredDialogueModelId')
  })

  it('should not contain redundant bottom configure_providers button since ModelSwitcher has it', () => {
    expect(sectionSource).not.toContain('CardLinkAction')
    expect(sectionSource).not.toContain('settings.configure_providers')
  })
})
