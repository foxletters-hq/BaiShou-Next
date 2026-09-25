import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown } from 'lucide-react'
import { Button } from '../Button/Button'
import type { AssistantEditPageProps } from './assistant-edit.types'
import { DEFAULT_BUILTIN_ASSISTANT_AVATAR_PATH, isSystemLatteAssistantId } from '@baishou/shared'
import { useAssistantEditPage } from './useAssistantEditPage'
import { AssistantEditAppBar } from './AssistantEditAppBar'
import { AssistantEditAvatarSection } from './AssistantEditAvatarSection'
import { AssistantEditModelBinding } from './AssistantEditModelBinding'
import { AssistantEditContextSection } from './AssistantEditContextSection'
import { AssistantEditCompressionSection } from './AssistantEditCompressionSection'
import { AssistantEditEmojiGroupSection } from './AssistantEditEmojiGroupSection'
import { AssistantDeleteConfirmDialog } from './AssistantDeleteConfirmDialog'
import { AssistantModelPicker } from './AssistantModelPicker'
import { AssistantKindTabBar } from '../AssistantKindTabBar'
import { Input } from '../Input/Input'
import { ResizableMarkdownEditor } from '../ResizableMarkdownEditor'
import stack from '../shared/SettingsStack.module.css'
import styles from './AssistantEditPage.module.css'

export type { AssistantFormData, AssistantEditPageProps } from './assistant-edit.types'

export const AssistantEditPage: React.FC<AssistantEditPageProps> = ({
  assistant,
  isLastAssistant = false,
  onSave,
  onPatchSave,
  onDelete,
  onBack
}) => {
  const { t } = useTranslation()
  const form = useAssistantEditPage({ assistant, onSave, onPatchSave })
  const [moreOpen, setMoreOpen] = useState(form.isEditing)

  return (
    <div className={styles.scaffold}>
      <AssistantEditAppBar isEditing={form.isEditing} onBack={onBack} />

      <div className={styles.splitArea}>
        <aside className={styles.identityPane}>
          <div className={stack.stack}>
            <div className={stack.stackGroup}>
              <section className={`${stack.cardSection} ${stack.cardBodyPadded}`}>
                <AssistantEditAvatarSection
                  avatarPath={form.avatarPath}
                  onSelectBuiltin={(path) => form.setAvatarPath(path)}
                  onUploadImage={(value) => form.setAvatarPath(value)}
                  showReset={form.showResetBuiltin}
                  onResetToDefault={() => form.setAvatarPath(DEFAULT_BUILTIN_ASSISTANT_AVATAR_PATH)}
                />
                <p className={styles.avatarHint}>{t('common.edit_avatar', '点击修改头像')}</p>
              </section>
            </div>

            {!isSystemLatteAssistantId(assistant?.id) ? (
              <div className={stack.stackGroup}>
                <div className={stack.sectionLabelRow}>
                  <h3 className={stack.sectionLabel}>{t('agent.assistant.kind_label', '类型')}</h3>
                </div>
                <section className={stack.cardSection}>
                  <AssistantKindTabBar
                    variant="cards"
                    activeKind={form.assistantKind}
                    onKindChange={form.handleKindChange}
                  />
                </section>
              </div>
            ) : null}

            <div className={styles.fieldBlock}>
              <h3 className={stack.sectionLabel}>{t('agent.assistant.name_label', '名称')}</h3>
              <Input
                value={form.name}
                onChange={(e) => form.setName(e.target.value)}
                placeholder={t('agent.assistant.name_hint')}
              />
            </div>

            <div className={styles.fieldBlock}>
              <h3 className={stack.sectionLabel}>
                {t('agent.assistant.description_label', '简介')}
              </h3>
              <ResizableMarkdownEditor
                variant="formField"
                content={form.description}
                onChange={(value) => form.setDescription(value || '')}
                placeholder={t('agent.assistant.description_hint', '简短描述你的伙伴')}
                defaultHeight={88}
                minHeight={72}
                maxHeight={200}
              />
            </div>
          </div>
        </aside>

        <section className={styles.voicePane}>
          <div className={stack.stack}>
            <div className={styles.fieldBlock}>
              <h3 className={stack.sectionLabel}>
                {t('agent.assistant.voice_section_title', '这个人会怎么说话')}
              </h3>
              <ResizableMarkdownEditor
                variant="formField"
                content={form.systemPrompt}
                onChange={(value) => form.setSystemPrompt(value || '')}
                placeholder={t('agent.assistant.prompt_hint', '你是一个AI助手...')}
                defaultHeight={form.isEditing ? 240 : 260}
                minHeight={180}
                maxHeight={640}
              />
              {form.isEditing && isSystemLatteAssistantId(assistant?.id) ? (
                <p className={styles.fieldHint}>
                  {t('settings.latte_edit_hint', '人设与自定义提示词也可在「设置 → Latte」中管理')}
                </p>
              ) : null}
            </div>

            <div className={stack.stackGroup}>
              <Button
                type="button"
                variant="outlined"
                size="small"
                aria-expanded={moreOpen}
                onClick={() => setMoreOpen((open) => !open)}
              >
                {t('agent.assistant.more_settings_label', '更多设置')}
                <ChevronDown
                  size={14}
                  aria-hidden
                  className={`${styles.moreChevron} ${moreOpen ? styles.moreChevronOpen : ''}`}
                />
              </Button>
              {moreOpen ? (
                <section className={stack.cardSection}>
                  {form.globalEmojiEnabled ? (
                    <>
                      <div className={styles.settingsRow}>
                        <AssistantEditEmojiGroupSection
                          emojiConfig={form.emojiConfig}
                          emojiEnabled={form.emojiEnabled}
                          selectedGroupIds={form.selectedEmojiGroupIds}
                          onEmojiEnabledChange={form.setEmojiEnabled}
                          onToggleGroup={form.toggleEmojiGroup}
                          onEmojiConfigChange={form.handleEmojiConfigChange}
                        />
                      </div>
                      <div className={stack.divider} />
                    </>
                  ) : null}
                  <div className={styles.settingsRow}>
                    <AssistantEditModelBinding
                      providerId={form.providerId}
                      modelId={form.modelId}
                      onOpenPicker={() => form.setProviderPickerOpen(true)}
                      onClearBinding={form.clearModelBinding}
                    />
                  </div>
                  <div className={stack.divider} />
                  <div className={styles.settingsRow}>
                    <AssistantEditContextSection
                      contextWindow={form.contextWindow}
                      isUnlimitedContext={form.isUnlimitedContext}
                      onContextWindowChange={form.setContextWindow}
                      onContextWindowCommit={form.commitContextWindow}
                    />
                  </div>
                  <div className={stack.divider} />
                  <div className={styles.settingsRow}>
                    <AssistantEditCompressionSection
                      compressThreshold={form.compressThreshold}
                      compressKeepTurns={form.compressKeepTurns}
                      isCompressDisabled={form.isCompressDisabled}
                      onCompressThresholdChange={form.setCompressThreshold}
                      onCompressThresholdCommit={form.commitCompressThreshold}
                      onCompressKeepTurnsChange={form.setCompressKeepTurns}
                      onCompressKeepTurnsCommit={form.commitCompressKeepTurns}
                      onToggleCompress={form.handleToggleCompress}
                    />
                  </div>
                </section>
              ) : null}
            </div>
          </div>
        </section>
      </div>

      <div className={styles.formFooter}>
        <div className={styles.formFooterInner}>
          {form.isEditing && !isLastAssistant && onDelete ? (
            <Button
              type="button"
              variant="outlined"
              size="small"
              onClick={() => form.setShowDeleteConfirm(true)}
              disabled={form.saving}
            >
              {t('common.delete', '删除')}
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outlined"
            size="small"
            className={form.isEditing && !isLastAssistant && onDelete ? '' : styles.filledBtnSolo}
            onClick={form.handleSave}
            disabled={!form.name.trim()}
            isLoading={form.saving}
          >
            {form.isEditing
              ? t('common.save', '保存')
              : t('agent.assistant.create_save', '创建并保存')}
          </Button>
        </div>
      </div>

      <AssistantModelPicker
        isOpen={form.providerPickerOpen}
        pickerProviders={form.pickerProviders}
        providerId={form.providerId}
        modelId={form.modelId}
        onSelect={(pid, mid) => {
          form.setProviderId(pid)
          form.setModelId(mid)
          form.setProviderPickerOpen(false)
        }}
        onClose={() => form.setProviderPickerOpen(false)}
      />

      <AssistantDeleteConfirmDialog
        isOpen={form.showDeleteConfirm}
        onConfirm={() => {
          form.setShowDeleteConfirm(false)
          onDelete?.()
        }}
        onCancel={() => form.setShowDeleteConfirm(false)}
      />
    </div>
  )
}
