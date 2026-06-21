import React from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import type { AssistantEditPageProps } from './assistant-edit.types'
import { DEFAULT_BUILTIN_ASSISTANT_AVATAR_PATH } from '@baishou/shared'
import { useAssistantEditPage } from './useAssistantEditPage'
import { AssistantEditAppBar } from './AssistantEditAppBar'
import { AssistantEditAvatarSection } from './AssistantEditAvatarSection'
import { AssistantEditModelBinding } from './AssistantEditModelBinding'
import { AssistantEditContextSection } from './AssistantEditContextSection'
import { AssistantEditCompressionSection } from './AssistantEditCompressionSection'
import { AssistantDeleteConfirmDialog } from './AssistantDeleteConfirmDialog'
import { AssistantModelPicker } from './AssistantModelPicker'
import { AssistantKindTabBar } from '../AssistantKindTabBar'
import { ResizableMarkdownEditor } from '../ResizableMarkdownEditor'
import styles from './AssistantEditPage.module.css'

export type { AssistantFormData, AssistantEditPageProps } from './assistant-edit.types'

export const AssistantEditPage: React.FC<AssistantEditPageProps> = ({
  assistant,
  isLastAssistant = false,
  onSave,
  onDelete,
  onBack
}) => {
  const { t } = useTranslation()
  const form = useAssistantEditPage({ assistant, onSave })

  return (
    <div className={styles.scaffold}>
      <AssistantEditAppBar isEditing={form.isEditing} onBack={onBack} />

      <div className={styles.scrollArea}>
        <div className={`${styles.formContainer} ${styles.contentColumn}`}>
          <section className={styles.sectionCard}>
            <AssistantEditAvatarSection
              avatarPath={form.avatarPath}
              onSelectBuiltin={(path) => form.setAvatarPath(path)}
              onUploadImage={(value) => form.setAvatarPath(value)}
              showReset={form.showResetBuiltin}
              onResetToDefault={() => form.setAvatarPath(DEFAULT_BUILTIN_ASSISTANT_AVATAR_PATH)}
            />
          </section>

          <section className={styles.sectionCard}>
            <AssistantKindTabBar
              activeKind={form.assistantKind}
              onKindChange={form.handleKindChange}
            />

            <div className={styles.spacer16} />

            <h3 className={styles.sectionTitle}>
              {t('agent.assistant.partner_info_label', '伙伴信息')}
            </h3>

            <div className={styles.spacer16} />

            <label className={styles.fieldLabel}>{t('agent.assistant.name_label', '名称')}</label>
            <input
              className={styles.inputField}
              value={form.name}
              onChange={(e) => form.setName(e.target.value)}
              placeholder={t('agent.assistant.name_hint')}
            />

            <div className={styles.spacer16} />

            <label className={styles.fieldLabel}>
              {t('agent.assistant.description_label', '简介')}
            </label>
            <ResizableMarkdownEditor
              content={form.description}
              onChange={(value) => form.setDescription(value || '')}
              placeholder={t('agent.assistant.description_hint', '简短描述你的伙伴')}
              defaultHeight={96}
              minHeight={72}
              maxHeight={240}
            />

            <div className={styles.spacer16} />

            <label className={styles.fieldLabel}>{t('agent.assistant.prompt_label', '提示词')}</label>
            <ResizableMarkdownEditor
              content={form.systemPrompt}
              onChange={(value) => form.setSystemPrompt(value || '')}
              placeholder={t('agent.assistant.prompt_hint', '你是一个AI助手...')}
              defaultHeight={220}
              minHeight={140}
              maxHeight={520}
            />
          </section>

          <section className={styles.sectionCard}>
            <AssistantEditModelBinding
              providerId={form.providerId}
              modelId={form.modelId}
              onOpenPicker={() => form.setProviderPickerOpen(true)}
              onClearBinding={form.clearModelBinding}
            />
          </section>

          <section className={styles.sectionCard}>
            <AssistantEditContextSection
              contextWindow={form.contextWindow}
              isUnlimitedContext={form.isUnlimitedContext}
              onContextWindowChange={form.setContextWindow}
            />
          </section>

          <section className={styles.sectionCard}>
            <AssistantEditCompressionSection
              compressThreshold={form.compressThreshold}
              compressKeepTurns={form.compressKeepTurns}
              isCompressDisabled={form.isCompressDisabled}
              onCompressThresholdChange={form.setCompressThreshold}
              onCompressKeepTurnsChange={form.setCompressKeepTurns}
              onToggleCompress={(enabled) => form.setCompressThreshold(enabled ? 60000 : 0)}
            />
          </section>
        </div>
      </div>

      <div className={styles.formFooter}>
        <div className={`${styles.formFooterInner} ${styles.contentColumn}`}>
          {form.isEditing && !isLastAssistant && onDelete ? (
            <button
              type="button"
              className={styles.outlineDangerBtn}
              onClick={() => form.setShowDeleteConfirm(true)}
              disabled={form.saving}
            >
              {t('common.delete', '删除')}
            </button>
          ) : null}
          <button
            type="button"
            className={`${styles.filledBtn} ${form.isEditing && !isLastAssistant && onDelete ? '' : styles.filledBtnSolo}`}
            onClick={form.handleSave}
            disabled={form.saving || !form.name.trim()}
          >
            {form.saving ? (
              <Loader2 size={20} className={styles.spinIcon} />
            ) : (
              t('common.save', '保存')
            )}
          </button>
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
