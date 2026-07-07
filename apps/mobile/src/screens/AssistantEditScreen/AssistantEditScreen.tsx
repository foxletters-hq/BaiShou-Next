import React from 'react'
import { View, Text, TouchableOpacity, ScrollView } from 'react-native'
import { scrollIndicatorStyle, ModelSwitcher } from '@baishou/ui/native'
import { StackScreenLayout } from '../../components/StackScreenLayout'
import { getStackScreenChrome } from '../../components/stackScreenChrome'
import { assistantEditScreenStyles as styles } from './assistant-edit-screen.styles'
import { useAssistantEditForm } from './hooks/useAssistantEditForm'
import { AssistantEditFormBody } from './components/AssistantEditFormBody'
import { AssistantEditMemorySection } from './components/AssistantEditMemorySection'

export const AssistantEditScreen: React.FC = () => {
  const form = useAssistantEditForm()

  if (form.loading) {
    return (
      <StackScreenLayout
        title={form.screenTitle}
        {...getStackScreenChrome(form.colors)}
        contentStyle={styles.loadingContainer}
      >
        <Text style={[styles.loadingText, { color: form.colors.textSecondary }]}>
          {form.t('common.loading')}
        </Text>
      </StackScreenLayout>
    )
  }

  return (
    <StackScreenLayout
      title={form.screenTitle}
      {...getStackScreenChrome(form.colors)}
      contentStyle={styles.layoutContent}
    >
      <View style={styles.pageBody}>
        <ScrollView
          style={[styles.content, { backgroundColor: form.colors.bgApp }]}
          contentContainerStyle={styles.contentContainer}
          indicatorStyle={scrollIndicatorStyle(form.isDark)}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
          scrollEnabled={form.outerScrollEnabled}
        >
          <AssistantEditFormBody
            colors={form.colors}
            t={form.t}
            storedAvatarPath={form.storedAvatarPath}
            previewAvatarUri={form.previewAvatarUri}
            handleSelectBuiltin={form.handleSelectBuiltin}
            handlePickImage={() => void form.handlePickImage()}
            assistantKind={form.assistantKind}
            handleKindChange={form.handleKindChange}
            name={form.name}
            setName={form.setName}
            description={form.description}
            setDescription={form.setDescription}
            systemPrompt={form.systemPrompt}
            setSystemPrompt={form.setSystemPrompt}
            providerId={form.providerId}
            clearModelBinding={form.clearModelBinding}
            openModelSwitcher={() => void form.openModelSwitcher()}
            modelId={form.modelId}
            globalEmojiEnabled={form.globalEmojiEnabled}
            emojiGroups={form.emojiGroups}
            emojiEnabled={form.emojiEnabled}
            selectedEmojiGroupIds={form.selectedEmojiGroupIds}
            handleEmojiEnabledChange={form.handleEmojiEnabledChange}
            handleToggleEmojiGroup={form.handleToggleEmojiGroup}
            setOuterScrollEnabled={form.setOuterScrollEnabled}
          />
          <AssistantEditMemorySection
            colors={form.colors}
            t={form.t}
            i18nLanguage={form.i18n.language}
            isUnlimitedContext={form.isUnlimitedContext}
            contextWindow={form.contextWindow}
            setContextWindow={form.setContextWindow}
            isCompressDisabled={form.isCompressDisabled}
            compressTokenThreshold={form.compressTokenThreshold}
            setCompressTokenThreshold={form.setCompressTokenThreshold}
            compressKeepTurns={form.compressKeepTurns}
            setCompressKeepTurns={form.setCompressKeepTurns}
            compressSystemPrompt={form.compressSystemPrompt}
            setCompressSystemPrompt={form.setCompressSystemPrompt}
            persistMemoryConfig={form.persistMemoryConfig}
          />
        </ScrollView>

        <View
          style={[
            styles.bottomBar,
            {
              borderTopColor: form.colors.borderSubtle,
              backgroundColor: form.colors.bgApp,
              paddingBottom: Math.max(form.insets.bottom, 12)
            }
          ]}
        >
          {form.canDelete ? (
            <TouchableOpacity
              style={[
                styles.bottomBtn,
                styles.bottomBtnOutline,
                { borderColor: form.colors.borderSubtle, backgroundColor: form.colors.bgSurface }
              ]}
              onPress={() => void form.handleDelete()}
              disabled={form.saving}
            >
              <Text style={[styles.bottomBtnText, { color: form.colors.error }]}>
                {form.t('common.delete', '删除')}
              </Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            style={[
              styles.bottomBtn,
              form.canDelete ? styles.bottomBtnPrimary : styles.bottomBtnFull,
              { backgroundColor: form.colors.primary }
            ]}
            onPress={() => void form.handleSave()}
            disabled={form.saving}
          >
            <Text style={[styles.bottomBtnText, { color: form.colors.textOnPrimary }]}>
              {form.saving ? form.t('common.saving', '保存中...') : form.t('common.save', '保存')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ModelSwitcher
        isOpen={form.showModelSwitcher}
        onClose={() => form.setShowModelSwitcher(false)}
        providers={form.chatProviders}
        currentProviderId={form.providerId}
        currentModelId={form.modelId}
        onSelect={(pid, mid) => {
          form.setProviderId(pid)
          form.setModelId(mid)
          form.setShowModelSwitcher(false)
        }}
        onManageProviders={() => form.router.push('/settings/ai-services')}
      />
    </StackScreenLayout>
  )
}
