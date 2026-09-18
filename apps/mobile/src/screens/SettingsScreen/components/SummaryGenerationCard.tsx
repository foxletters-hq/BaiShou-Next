import React from 'react'
import { View, Text, TouchableOpacity, Image, Modal, ScrollView } from 'react-native'
import { useTranslation } from 'react-i18next'
import {
  clampSharedMemoryLookbackMonths,
  SHARED_MEMORY_LOOKBACK_MIN,
  SHARED_MEMORY_LOOKBACK_SLIDER_BASE,
  type SummaryGenerationMode,
  type SummaryPromptLocale
} from '@baishou/shared'
import { Input, NativeSlider, Switch, useNativeTheme, useNativeToast } from '@baishou/ui/native'
import { SettingsGroupCard } from './SettingsGroupCard'
import { SummaryPromptLocaleBar } from './SummaryPromptLocaleBar'
import { summarySettingsStyles as styles } from './summary-settings.styles'

type Partner = { id: string; name: string; displayAvatarUri?: string }

export function SummaryGenerationCard(props: {
  generationMode: SummaryGenerationMode
  generationAssistantId?: string
  selectedPartner?: Partner
  assistants: Partner[]
  partnerPickerOpen: boolean
  setPartnerPickerOpen: (open: boolean) => void
  injectSharedMemory: boolean
  lookbackMonths: number
  lookbackMonthsRef: { current: number }
  setLookbackMonths: (n: number) => void
  localSystemPrompt: string
  activePromptLocale: SummaryPromptLocale
  generationLocale: SummaryPromptLocale
  persistAutoSettings: (overrides: {
    generationMode?: SummaryGenerationMode
    generationAssistantId?: string
    injectSharedMemory?: boolean
    lookbackMonths?: number
  }) => void
  onPromptLocaleChange: (locale: SummaryPromptLocale) => void
  onSystemPromptChange: (text: string) => void
  onSystemPromptBlur: () => void
  onRestoreSystemPrompt: () => void
}) {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const toast = useNativeToast()
  const {
    generationMode,
    generationAssistantId,
    selectedPartner,
    assistants,
    partnerPickerOpen,
    setPartnerPickerOpen,
    injectSharedMemory,
    lookbackMonths,
    lookbackMonthsRef,
    setLookbackMonths,
    localSystemPrompt,
    activePromptLocale,
    generationLocale,
    persistAutoSettings,
    onPromptLocaleChange,
    onSystemPromptChange,
    onSystemPromptBlur,
    onRestoreSystemPrompt
  } = props

  return (
    <>
      <SettingsGroupCard>
        <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
          {t('settings.summary_generation_mode_title')}
        </Text>
        <Text style={[styles.desc, { color: colors.textSecondary }]}>
          {t('settings.summary_generation_mode_desc')}
        </Text>
        <View style={[styles.sourceGroup, { backgroundColor: colors.bgApp }]}>
          {(['prompt', 'assistant'] as const).map((mode) => {
            const active = generationMode === mode
            const labelKey =
              mode === 'prompt'
                ? 'settings.summary_generation_mode_prompt'
                : 'settings.summary_generation_mode_assistant'
            return (
              <TouchableOpacity
                key={mode}
                style={[styles.sourceBtn, active && { backgroundColor: colors.primary }]}
                onPress={() => {
                  if (mode === 'assistant') {
                    if (assistants.length === 0) {
                      toast.showError(t('settings.summary_generation_assistant_required'))
                      return
                    }
                    const nextId =
                      generationAssistantId &&
                      assistants.some((a) => a.id === generationAssistantId)
                        ? generationAssistantId
                        : assistants[0]!.id
                    persistAutoSettings({
                      generationMode: 'assistant',
                      generationAssistantId: nextId
                    })
                    return
                  }
                  persistAutoSettings({ generationMode: 'prompt' })
                }}
              >
                <Text
                  style={{
                    color: active ? colors.textOnPrimary : colors.textSecondary,
                    fontSize: 13,
                    fontWeight: active ? '600' : '400',
                    textAlign: 'center'
                  }}
                >
                  {t(labelKey)}
                </Text>
              </TouchableOpacity>
            )
          })}
        </View>

        {generationMode === 'prompt' && (
          <View style={styles.systemPromptBlock}>
            <Text style={[styles.subsectionTitle, { color: colors.textPrimary }]}>
              {t('settings.summary_custom_system_prompt_title')}
            </Text>
            <Text style={[styles.desc, { color: colors.textSecondary }]}>
              {t('settings.summary_custom_system_prompt_desc')}
            </Text>
            <SummaryPromptLocaleBar
              activePromptLocale={activePromptLocale}
              generationLocale={generationLocale}
              onChange={onPromptLocaleChange}
            />
            <Input
              value={localSystemPrompt}
              onChangeText={onSystemPromptChange}
              onBlur={onSystemPromptBlur}
              multiline
              textarea
              numberOfLines={8}
              placeholder={t('settings.summary_custom_system_prompt_hint')}
              style={{ minHeight: 140, lineHeight: 20 }}
              containerStyle={{ marginBottom: 8 }}
            />
            <TouchableOpacity
              style={[styles.btn, { borderColor: colors.borderControl, marginBottom: 4 }]}
              onPress={onRestoreSystemPrompt}
            >
              <Text style={{ color: colors.textSecondary }}>{t('settings.restore_default')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {generationMode === 'assistant' && (
          <View style={styles.assistantBlock}>
            <Text style={[styles.subsectionTitle, { color: colors.textPrimary }]}>
              {t('settings.summary_generation_assistant_label')}
            </Text>
            <TouchableOpacity
              style={[
                styles.partnerCard,
                { borderColor: colors.borderControl, backgroundColor: colors.bgSurface }
              ]}
              onPress={() => setPartnerPickerOpen(true)}
            >
              {selectedPartner?.displayAvatarUri ? (
                <Image
                  source={{ uri: selectedPartner.displayAvatarUri }}
                  style={styles.partnerAvatarImage}
                />
              ) : (
                <View style={[styles.partnerAvatar, { backgroundColor: colors.primary + '22' }]}>
                  <Text style={{ color: colors.primary, fontWeight: '600', fontSize: 14 }}>
                    {(selectedPartner?.name || '?').slice(0, 1)}
                  </Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={[styles.partnerName, { color: colors.textPrimary }]}>
                  {selectedPartner?.name || t('settings.summary_generation_assistant_placeholder')}
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 2 }}>
                  {t('settings.summary_generation_partner_change')}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.injectRow}>
          <View style={styles.injectText}>
            <Text style={[styles.subsectionTitle, { color: colors.textPrimary, marginBottom: 4 }]}>
              {t('settings.summary_inject_shared_memory')}
            </Text>
            <Text style={[styles.desc, { color: colors.textSecondary, marginBottom: 0 }]}>
              {t('settings.summary_inject_shared_memory_desc')}
            </Text>
          </View>
          <Switch
            value={injectSharedMemory}
            onValueChange={(v) => persistAutoSettings({ injectSharedMemory: v })}
          />
        </View>

        {injectSharedMemory && (
          <View style={styles.lookbackBlock}>
            <View style={styles.lookbackLabelRow}>
              <Text style={[styles.fieldLabel, { color: colors.textPrimary, marginBottom: 0 }]}>
                {t('settings.summary_inject_lookback_label')}
              </Text>
              <Input
                value={String(lookbackMonths)}
                onChangeText={(text) => {
                  const n = Number(text.replace(/[^\d]/g, ''))
                  if (!Number.isFinite(n)) return
                  setLookbackMonths(clampSharedMemoryLookbackMonths(n || 1))
                }}
                onBlur={() =>
                  persistAutoSettings({
                    lookbackMonths: clampSharedMemoryLookbackMonths(lookbackMonthsRef.current)
                  })
                }
                keyboardType="number-pad"
                style={{ textAlign: 'center' }}
                containerStyle={{ marginBottom: 0, width: 72 }}
              />
            </View>
            <NativeSlider
              minValue={SHARED_MEMORY_LOOKBACK_MIN}
              maxValue={Math.max(SHARED_MEMORY_LOOKBACK_SLIDER_BASE, lookbackMonths)}
              step={1}
              value={lookbackMonths}
              onChange={(v) => setLookbackMonths(clampSharedMemoryLookbackMonths(v))}
              onChangeEnd={(v) =>
                persistAutoSettings({
                  lookbackMonths: clampSharedMemoryLookbackMonths(v)
                })
              }
            />
          </View>
        )}
      </SettingsGroupCard>

      <Modal
        visible={partnerPickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setPartnerPickerOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setPartnerPickerOpen(false)}
        >
          <View
            style={[styles.modalSheet, { backgroundColor: colors.bgSurface }]}
            onStartShouldSetResponder={() => true}
          >
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
              {t('settings.summary_generation_assistant_placeholder')}
            </Text>
            <ScrollView style={{ maxHeight: 360 }}>
              {assistants.map((a) => {
                const active = a.id === generationAssistantId
                return (
                  <TouchableOpacity
                    key={a.id}
                    style={[
                      styles.partnerPickerItem,
                      active && { backgroundColor: colors.primary }
                    ]}
                    onPress={() => {
                      persistAutoSettings({
                        generationMode: 'assistant',
                        generationAssistantId: a.id
                      })
                      setPartnerPickerOpen(false)
                    }}
                  >
                    {a.displayAvatarUri ? (
                      <Image
                        source={{ uri: a.displayAvatarUri }}
                        style={styles.partnerAvatarImageSmall}
                      />
                    ) : (
                      <View
                        style={[
                          styles.partnerAvatarSmall,
                          {
                            backgroundColor: active
                              ? 'rgba(255,255,255,0.25)'
                              : colors.primary + '22'
                          }
                        ]}
                      >
                        <Text
                          style={{
                            color: active ? colors.textOnPrimary : colors.primary,
                            fontWeight: '600',
                            fontSize: 13
                          }}
                        >
                          {a.name.slice(0, 1)}
                        </Text>
                      </View>
                    )}
                    <Text
                      style={{
                        color: active ? colors.textOnPrimary : colors.textPrimary,
                        fontWeight: active ? '600' : '400',
                        fontSize: 14,
                        flex: 1
                      }}
                    >
                      {a.name}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  )
}
