import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))

describe('native Modal actions chrome', () => {
  it('should expose a right-aligned action row for compact dialog buttons', () => {
    const source = readFileSync(join(here, '../Modal.tsx'), 'utf8')
    expect(source).toContain('export const modalActionsStyle')
    expect(source).toContain("justifyContent: 'flex-end'")
    expect(source).toContain("flexDirection: 'row'")
    expect(source).toContain('flexShrink: 0')
    expect(source).toContain("overflow: 'hidden'")
  })

  it('should cover system bars immediately and keep the card hugging content', () => {
    const source = readFileSync(join(here, '../Modal.tsx'), 'utf8')
    expect(source).toContain('statusBarTranslucent')
    expect(source).toContain('navigationBarTranslucent')
    expect(source).toContain('presentationStyle="overFullScreen"')
    expect(source).toContain('colors.bgOverlay')
    expect(source).toContain("Dimensions.get('screen').height")
    expect(source).toContain('StyleSheet.absoluteFillObject')
    expect(source).toContain('flex: 1')
    expect(source).toContain('collapsable={false}')
    expect(source).toContain('flexGrow: 0')
    expect(source).toMatch(/body:\s*\{[\s\S]*width: '100%'/)
    expect(source).toMatch(/body:\s*\{[\s\S]*alignSelf: 'stretch'/)
  })

  it('should ignore the opening tap on the backdrop so the modal stays open', () => {
    const source = readFileSync(join(here, '../Modal.tsx'), 'utf8')
    expect(source).toContain('MODAL_BACKDROP_ARM_MS')
    expect(source).toContain('setBackdropArmed')
    expect(source).toContain("pointerEvents={backdropArmed ? 'auto' : 'none'}")
  })

  it('should lift the card above the keyboard with the shared inset helper', () => {
    const source = readFileSync(join(here, '../Modal.tsx'), 'utf8')
    expect(source).toContain('useKeyboardHeight')
    expect(source).toContain('modalKeyboardPadding')
    expect(source).toContain('modalCardMaxHeight')
    expect(source).toContain('paddingBottom: keyboardInset')
    expect(source).toContain('avoidKeyboard')
    expect(source).toContain('activeKeyboardHeight')
  })

  it('should maintain scroll indicator padding in dialog modals aligned with §3.12 spec', () => {
    const skillDialog = readFileSync(
      join(here, '../../ChatBubble/SkillCitePreviewDialog.tsx'),
      'utf8'
    )
    const citeBlock = readFileSync(
      join(here, '../../KnowledgeCitationBlock/KnowledgeCitationBlock.tsx'),
      'utf8'
    )
    const ragCard = readFileSync(join(here, '../../RagMemoryView/RagMemoryEntryCard.tsx'), 'utf8')
    const ragStyles = readFileSync(join(here, '../../RagMemoryView/rag-memory.styles.ts'), 'utf8')
    const identityFacts = readFileSync(
      join(here, '../../IdentitySettingsCard/IdentityFactsDialog.tsx'),
      'utf8'
    )
    const ragSettings = readFileSync(
      join(here, '../../RagMemoryView/RagMemorySettingsModal.tsx'),
      'utf8'
    )
    const dialog = readFileSync(join(here, '../../Dialog/Dialog.tsx'), 'utf8')
    const gateDiff = readFileSync(
      join(here, '../../AgentGateCard/AgentGatePreviewBlocks.tsx'),
      'utf8'
    )
    const attachmentFilter = readFileSync(
      join(here, '../../AttachmentManagementView/AttachmentFilterSheet.tsx'),
      'utf8'
    )
    const heatmap = readFileSync(join(here, '../../ActivityHeatmap/ActivityHeatmap.tsx'), 'utf8')
    const emojiTool = readFileSync(join(here, '../../AgentToolsView/EmojiToolCard.tsx'), 'utf8')
    const assistantPicker = readFileSync(
      join(here, '../../AssistantPicker/AssistantPicker.tsx'),
      'utf8'
    )

    expect(skillDialog).toContain('paddingRight: sharedTokens.spacing.mdTight')
    expect(citeBlock).toContain('paddingRight: sharedTokens.spacing.mdTight')
    expect(ragCard).toContain('contentContainerStyle={styles.entryPreviewContent}')
    expect(ragStyles).toContain(
      'entryPreviewContent: { paddingRight: sharedTokens.spacing.mdTight }'
    )
    expect(identityFacts).toContain('paddingRight: sharedTokens.spacing.mdTight')
    expect(ragSettings).toContain('paddingRight: sharedTokens.spacing.mdTight')
    expect(ragSettings).toContain('keyboardShouldPersistTaps="handled"')
    expect(dialog).toContain('paddingRight: sharedTokens.spacing.mdTight')
    expect(gateDiff).toContain('paddingRight: sharedTokens.spacing.mdTight')
    expect(attachmentFilter).toContain('paddingRight: sharedTokens.spacing.mdTight')
    expect(heatmap).toContain('paddingRight: sharedTokens.spacing.mdTight')
    expect(emojiTool).toContain('paddingRight: sharedTokens.spacing.mdTight')
    expect(assistantPicker).toContain('paddingRight: sharedTokens.spacing.mdTight')

    expect(ragCard).toContain('modalActionsStyle')
    expect(ragCard).not.toContain("alignSelf: 'flex-start'")
    expect(citeBlock).toContain('modalActionsStyle')
    expect(ragSettings).toContain('modalActionsStyle')
  })
})
