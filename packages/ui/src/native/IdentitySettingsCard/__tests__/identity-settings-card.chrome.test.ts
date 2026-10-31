import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))

describe('native IdentitySettingsCard chrome', () => {
  it('should navigate to identity management instead of expanding facts', () => {
    const src = readFileSync(join(here, '../IdentitySettingsCard.tsx'), 'utf8')
    expect(src).toContain('onManageIdentity')
    expect(src).toContain('identity_current_named')
    expect(src).not.toContain('IdentitySettingsFactsSection')
    expect(src).not.toContain('SettingsExpansionTile')
  })

  it('should disable avoidKeyboard on facts dialog and enable it on fact edit modal', () => {
    const factsDialogSrc = readFileSync(join(here, '../IdentityFactsDialog.tsx'), 'utf8')
    const factModalSrc = readFileSync(join(here, '../IdentitySettingsFactModal.tsx'), 'utf8')

    expect(factsDialogSrc).toContain('avoidKeyboard={false}')
    expect(factModalSrc).toContain("from '../Modal/Modal'")
    expect(factModalSrc).toContain('avoidKeyboard')
    expect(factModalSrc).not.toContain("Modal } from 'react-native'")
  })

  it('should bound the fact value textarea height and keep modal actions outside ScrollView for >200 chars', () => {
    const factModalSrc = readFileSync(join(here, '../IdentitySettingsFactModal.tsx'), 'utf8')

    expect(factModalSrc).toContain('<ScrollView')
    expect(factModalSrc).toContain('keyboardShouldPersistTaps="handled"')
    expect(factModalSrc).toContain('paddingRight: sharedTokens.spacing.mdTight')
    expect(factModalSrc).toContain('multiline')
    expect(factModalSrc).toContain('textarea')
    expect(factModalSrc).toContain('nestedScrollEnabled')
    expect(factModalSrc).toContain(
      'maxHeight: sharedTokens.spacing.xxxl * 3 + sharedTokens.spacing.xl'
    )
    expect(factModalSrc.indexOf('</ScrollView>')).toBeLessThan(
      factModalSrc.indexOf('<View style={modalActionsStyle}>')
    )
  })
})
