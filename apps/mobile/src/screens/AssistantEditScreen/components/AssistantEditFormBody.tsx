import React from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import { ChevronRight, Plus } from 'lucide-react-native'
import {
  Input,
  SettingsGroupCard,
  settingsCardStyles,
  ProviderBrandIcon,
  AssistantAvatarPicker,
  AssistantKindTabBar,
  AssistantEditEmojiSection
} from '@baishou/ui/native'
import type { TFunction } from 'i18next'
import type { EmojiGroup } from '@baishou/shared'
import type { AssistantKind } from '@baishou/shared'
import { assistantEditScreenStyles as styles } from '../assistant-edit-screen.styles'

export type AssistantEditFormBodyProps = {
  colors: Record<string, string>
  t: TFunction
  storedAvatarPath: string
  previewAvatarUri: string | null
  handleSelectBuiltin: (path: string) => void
  handlePickImage: () => void
  assistantKind: AssistantKind
  handleKindChange: (kind: AssistantKind) => void
  name: string
  setName: (v: string) => void
  description: string
  setDescription: (v: string) => void
  systemPrompt: string
  setSystemPrompt: (v: string) => void
  providerId?: string
  clearModelBinding: () => void
  openModelSwitcher: () => void
  modelId?: string
  globalEmojiEnabled: boolean
  emojiGroups: EmojiGroup[]
  emojiEnabled: boolean
  selectedEmojiGroupIds: string[]
  handleEmojiEnabledChange: (enabled: boolean) => void
  handleToggleEmojiGroup: (groupId: string) => void
  setOuterScrollEnabled: (enabled: boolean) => void
}

export function AssistantEditFormBody(props: AssistantEditFormBodyProps) {
  const {
    colors,
    t,
    storedAvatarPath,
    previewAvatarUri,
    handleSelectBuiltin,
    handlePickImage,
    assistantKind,
    handleKindChange,
    name,
    setName,
    description,
    setDescription,
    systemPrompt,
    setSystemPrompt,
    providerId,
    clearModelBinding,
    openModelSwitcher,
    modelId,
    globalEmojiEnabled,
    emojiGroups,
    emojiEnabled,
    selectedEmojiGroupIds,
    handleEmojiEnabledChange,
    handleToggleEmojiGroup,
    setOuterScrollEnabled
  } = props

  return (
    <>
      <SettingsGroupCard style={styles.avatarCard}>
        <AssistantAvatarPicker
          avatarPath={storedAvatarPath}
          previewUri={previewAvatarUri}
          onSelectBuiltin={handleSelectBuiltin}
          onPressUpload={() => void handlePickImage()}
        />
      </SettingsGroupCard>

      <SettingsGroupCard>
        <AssistantKindTabBar activeKind={assistantKind} onKindChange={handleKindChange} />

        <View style={styles.fieldGap} />

        <Text style={[settingsCardStyles.cardTitle, { color: colors.textPrimary }]}>
          {t('agent.assistant.name_label', '伙伴名称')}
        </Text>
        <Input value={name} onChangeText={setName} placeholder={t('agent.assistant.name_hint')} />

        <View style={styles.fieldGap} />

        <Text style={[settingsCardStyles.label, { color: colors.textPrimary }]}>
          {t('agent.assistant.description_label', '简介')}
        </Text>
        <Input
          value={description}
          onChangeText={setDescription}
          placeholder={t('agent.assistant.description_hint', '简短描述伙伴的用途...')}
          multiline
          numberOfLines={2}
        />

        <View style={styles.fieldGap} />

        <Text style={[settingsCardStyles.label, { color: colors.textPrimary }]}>
          {t('agent.assistant.prompt_label', '系统提示词')}
        </Text>
        <Input
          value={systemPrompt}
          onChangeText={setSystemPrompt}
          placeholder={t('agent.assistant.prompt_hint', '定义伙伴的角色、行为和回复风格...')}
          multiline
          textarea
          numberOfLines={8}
          style={{ minHeight: 160 }}
        />
      </SettingsGroupCard>

      <SettingsGroupCard>
        <View style={styles.row}>
          <Text style={[settingsCardStyles.label, { color: colors.textPrimary }]}>
            {t('agent.assistant.bind_model_label', '绑定模型')}
          </Text>
          {providerId ? (
            <TouchableOpacity onPress={clearModelBinding}>
              <Text style={[styles.textBtn, { color: colors.primary, marginTop: 0 }]}>
                {t('agent.assistant.use_global_model', '使用全局模型')}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {!providerId ? (
          <TouchableOpacity
            style={[styles.outlinedBtn, { borderColor: colors.borderSubtle }]}
            onPress={() => void openModelSwitcher()}
          >
            <Plus size={18} color={colors.textPrimary} strokeWidth={2} />
            <Text style={[styles.outlinedBtnText, { color: colors.textPrimary }]}>
              {t('agent.assistant.select_model_label', '选择模型（使用全局默认）')}
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.modelCard, { borderColor: colors.borderSubtle }]}
            onPress={() => void openModelSwitcher()}
            activeOpacity={0.75}
          >
            <ProviderBrandIcon providerId={providerId} size={24} />
            <View style={styles.modelInfo}>
              <Text style={[styles.modelSup, { color: colors.textSecondary }]} numberOfLines={1}>
                {providerId}
              </Text>
              <Text style={[styles.modelSub, { color: colors.textPrimary }]} numberOfLines={1}>
                {modelId}
              </Text>
            </View>
            <ChevronRight size={22} color={colors.textSecondary} strokeWidth={2} />
          </TouchableOpacity>
        )}

        <Text style={[settingsCardStyles.hint, { color: colors.textSecondary }]}>
          {t(
            'agent.assistant.bind_model_desc',
            '绑定后，和伙伴创建对话时，会默认优先使用选择的模型'
          )}
        </Text>
      </SettingsGroupCard>

      {globalEmojiEnabled ? (
        <AssistantEditEmojiSection
          emojiGroups={emojiGroups}
          emojiEnabled={emojiEnabled}
          selectedGroupIds={selectedEmojiGroupIds}
          onEmojiEnabledChange={handleEmojiEnabledChange}
          onToggleGroup={handleToggleEmojiGroup}
          onLockOuterScroll={(locked) => setOuterScrollEnabled(!locked)}
        />
      ) : null}
    </>
  )
}
