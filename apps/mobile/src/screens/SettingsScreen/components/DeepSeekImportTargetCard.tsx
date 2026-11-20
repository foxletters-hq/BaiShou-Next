import React, { useMemo } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Check, ChevronRight, Plus } from 'lucide-react-native'
import type { AssistantKind } from '@baishou/shared'
import {
  AssistantAvatar,
  AssistantAvatarPicker,
  AssistantKindBadge,
  AssistantKindTabBar,
  Input,
  ProviderBrandIcon,
  SegmentedContent,
  SegmentedControl,
  useNativeTheme
} from '@baishou/ui/native'
import { mobileTypography, sharedTokens } from '@baishou/ui/theme/tokens'
import type { MobileAssistantUi } from '../../../lib/mobile-assistant.util'
import type { DeepSeekTargetMode } from '../../../hooks/useDeepSeekImport'

export interface DeepSeekImportTargetCardProps {
  targetMode: DeepSeekTargetMode
  onChangeTargetMode: (mode: DeepSeekTargetMode) => void
  assistants: MobileAssistantUi[]
  loadingAssistants: boolean
  selectedAssistantId: string
  onSelectAssistant: (id: string) => void
  newAssistantKind: AssistantKind
  onChangeNewAssistantKind: (kind: AssistantKind) => void
  newAssistantName: string
  onChangeNewAssistantName: (value: string) => void
  newAssistantDescription: string
  onChangeNewAssistantDescription: (value: string) => void
  newAssistantSystemPrompt: string
  onChangeNewAssistantSystemPrompt: (value: string) => void
  newAssistantStoredAvatarPath: string
  newAssistantPreviewAvatarUri: string | null
  onSelectBuiltinAvatar: (avatarPath: string) => void
  onPickAvatarImage: () => void
  newAssistantProviderId?: string
  newAssistantModelId?: string
  onOpenModelSwitcher: () => void
  onClearModelBinding: () => void
  disabled?: boolean
}

export const DeepSeekImportTargetCard: React.FC<DeepSeekImportTargetCardProps> = ({
  targetMode,
  onChangeTargetMode,
  assistants,
  loadingAssistants,
  selectedAssistantId,
  onSelectAssistant,
  newAssistantKind,
  onChangeNewAssistantKind,
  newAssistantName,
  onChangeNewAssistantName,
  newAssistantDescription,
  onChangeNewAssistantDescription,
  newAssistantSystemPrompt,
  onChangeNewAssistantSystemPrompt,
  newAssistantStoredAvatarPath,
  newAssistantPreviewAvatarUri,
  onSelectBuiltinAvatar,
  onPickAvatarImage,
  newAssistantProviderId,
  newAssistantModelId,
  onOpenModelSwitcher,
  onClearModelBinding,
  disabled = false
}) => {
  const { t } = useTranslation()
  const { colors, tokens } = useNativeTheme()

  const modeOptions = useMemo(
    () => [
      { value: 'existing' as const, label: t('deepseek_import.target_mode_existing') },
      { value: 'new' as const, label: t('deepseek_import.target_mode_new') }
    ],
    [t]
  )

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.bgSurface,
          borderColor: colors.borderSubtle,
          borderRadius: tokens.radius.lg
        }
      ]}
    >
      <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
        {t('deepseek_import.target_section_title')}
      </Text>

      <SegmentedControl
        value={targetMode}
        options={modeOptions}
        onChange={onChangeTargetMode}
        disabled={disabled}
      />

      <SegmentedContent value={targetMode}>
        {targetMode === 'existing' ? (
          loadingAssistants ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : assistants.length === 0 ? (
            <Text style={[styles.emptyHint, { color: colors.textSecondary }]}>
              {t('deepseek_import.existing_empty')}
            </Text>
          ) : (
            <View style={styles.assistantList}>
              {assistants.map((assistant) => {
                const selected = assistant.id === selectedAssistantId
                return (
                  <TouchableOpacity
                    key={assistant.id}
                    disabled={disabled}
                    onPress={() => onSelectAssistant(assistant.id)}
                    activeOpacity={0.7}
                    style={[
                      styles.assistantRow,
                      {
                        backgroundColor: selected ? colors.bgSurfaceHigh : colors.bgSurface,
                        borderColor: selected ? colors.primary : colors.borderSubtle,
                        borderRadius: tokens.radius.md
                      }
                    ]}
                  >
                    <AssistantAvatar
                      emoji={assistant.emoji}
                      avatarPath={assistant.avatarPath}
                      resolvedAvatarUri={assistant.displayAvatarUri}
                      size={36}
                    />
                    <View style={styles.assistantMeta}>
                      <View style={styles.assistantNameRow}>
                        <Text
                          style={[styles.assistantName, { color: colors.textPrimary }]}
                          numberOfLines={1}
                        >
                          {assistant.name}
                        </Text>
                        <AssistantKindBadge kind={assistant.assistantKind} compact />
                      </View>
                      {assistant.description ? (
                        <Text
                          style={[styles.assistantDesc, { color: colors.textSecondary }]}
                          numberOfLines={1}
                        >
                          {assistant.description}
                        </Text>
                      ) : null}
                    </View>
                    {selected ? <Check size={18} color={colors.primary} strokeWidth={2.2} /> : null}
                  </TouchableOpacity>
                )
              })}
            </View>
          )
        ) : (
          <View style={styles.formStack}>
            <AssistantAvatarPicker
              avatarPath={newAssistantStoredAvatarPath}
              previewUri={newAssistantPreviewAvatarUri}
              onSelectBuiltin={onSelectBuiltinAvatar}
              onPressUpload={onPickAvatarImage}
            />

            <AssistantKindTabBar
              activeKind={newAssistantKind}
              onKindChange={onChangeNewAssistantKind}
            />

            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>
                {t('agent.assistant.name_label')}
              </Text>
              <Input
                value={newAssistantName}
                onChangeText={onChangeNewAssistantName}
                placeholder={t('agent.assistant.name_hint')}
                editable={!disabled}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>
                {t('agent.assistant.description_label')}
              </Text>
              <Input
                value={newAssistantDescription}
                onChangeText={onChangeNewAssistantDescription}
                placeholder={t('agent.assistant.description_hint')}
                multiline
                numberOfLines={2}
                editable={!disabled}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>
                {t('agent.assistant.prompt_label')}
              </Text>
              <Input
                value={newAssistantSystemPrompt}
                onChangeText={onChangeNewAssistantSystemPrompt}
                placeholder={t('agent.assistant.prompt_hint')}
                multiline
                textarea
                numberOfLines={6}
                style={styles.promptInput}
                editable={!disabled}
              />
            </View>

            <View style={styles.fieldGroup}>
              <View style={styles.modelHeaderRow}>
                <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>
                  {t('agent.assistant.bind_model_label')}
                </Text>
                {newAssistantProviderId ? (
                  <TouchableOpacity disabled={disabled} onPress={onClearModelBinding}>
                    <Text style={[styles.clearModelText, { color: colors.primary }]}>
                      {t('agent.assistant.use_global_model')}
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              {!newAssistantProviderId ? (
                <TouchableOpacity
                  style={[styles.outlinedModelBtn, { borderColor: colors.borderControl }]}
                  onPress={onOpenModelSwitcher}
                  disabled={disabled}
                  activeOpacity={0.75}
                >
                  <Plus size={18} color={colors.textPrimary} strokeWidth={2} />
                  <Text style={[styles.outlinedModelBtnText, { color: colors.textPrimary }]}>
                    {t('agent.assistant.select_model_label')}
                  </Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.modelCard, { borderColor: colors.borderSubtle }]}
                  onPress={onOpenModelSwitcher}
                  disabled={disabled}
                  activeOpacity={0.75}
                >
                  <ProviderBrandIcon providerId={newAssistantProviderId} size={24} />
                  <View style={styles.modelInfo}>
                    <Text
                      style={[styles.modelSup, { color: colors.textSecondary }]}
                      numberOfLines={1}
                    >
                      {newAssistantProviderId}
                    </Text>
                    <Text
                      style={[styles.modelSub, { color: colors.textPrimary }]}
                      numberOfLines={1}
                    >
                      {newAssistantModelId}
                    </Text>
                  </View>
                  <ChevronRight size={20} color={colors.textSecondary} strokeWidth={2} />
                </TouchableOpacity>
              )}

              <Text style={[styles.modelHint, { color: colors.textSecondary }]}>
                {t('agent.assistant.bind_model_desc')}
              </Text>
            </View>
          </View>
        )}
      </SegmentedContent>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    padding: sharedTokens.spacing.mdSnug,
    gap: sharedTokens.spacing.mdTight
  },
  sectionTitle: {
    fontSize: mobileTypography.primary.fontSize,
    fontWeight: '600'
  },
  loadingRow: {
    paddingVertical: sharedTokens.spacing.md,
    alignItems: 'center'
  },
  emptyHint: {
    fontSize: mobileTypography.secondary.fontSize,
    lineHeight: 20,
    paddingVertical: sharedTokens.spacing.xs
  },
  assistantList: {
    gap: sharedTokens.spacing.sm
  },
  assistantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: sharedTokens.spacing.smPlus,
    gap: sharedTokens.spacing.smPlus,
    borderWidth: 1
  },
  assistantMeta: {
    flex: 1,
    gap: sharedTokens.spacing.xxs
  },
  assistantNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sharedTokens.spacing.xsPlus
  },
  assistantName: {
    fontSize: mobileTypography.body.fontSize,
    fontWeight: '500',
    flexShrink: 1
  },
  assistantDesc: {
    fontSize: mobileTypography.caption.fontSize
  },
  formStack: {
    gap: sharedTokens.spacing.md
  },
  fieldGroup: {
    gap: sharedTokens.spacing.xsPlus
  },
  fieldLabel: {
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: '500'
  },
  promptInput: {
    minHeight: 140
  },
  modelHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: sharedTokens.spacing.sm
  },
  clearModelText: {
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: '500'
  },
  outlinedModelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: sharedTokens.spacing.sm,
    paddingVertical: sharedTokens.spacing.mdTight,
    paddingHorizontal: sharedTokens.spacing.md,
    borderRadius: sharedTokens.radius.md,
    borderWidth: 1
  },
  outlinedModelBtnText: {
    fontSize: mobileTypography.body.fontSize,
    fontWeight: '500'
  },
  modelCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sharedTokens.spacing.mdTight,
    padding: sharedTokens.spacing.mdTight,
    borderRadius: sharedTokens.radius.md,
    borderWidth: 1
  },
  modelInfo: {
    flex: 1,
    gap: sharedTokens.spacing.xxs
  },
  modelSup: {
    fontSize: mobileTypography.caption.fontSize
  },
  modelSub: {
    fontSize: mobileTypography.body.fontSize,
    fontWeight: '600'
  },
  modelHint: {
    fontSize: mobileTypography.caption.fontSize,
    lineHeight: 18
  }
})
