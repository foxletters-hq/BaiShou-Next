import React, { useState } from 'react'
import styles from './AIGlobalModelsView.module.css'
import { useTranslation } from 'react-i18next'
import { useDialog } from '../Dialog'
import { ModelSwitcherPopup } from '../ModelSwitcherPopup'
import { GlobalModelsConfig, GlobalModelsConfig as SharedGlobalModelsConfig } from '@baishou/shared'
import { isEmbeddingModel, isTtsModel } from '@baishou/shared'
import { MdChatBubbleOutline, MdCompress, MdEdit, MdHub, MdVolumeUp } from 'react-icons/md'
import { HelpTooltip } from '../HelpTooltip'

export interface AIProviderConfigInfo {
  providerId: string
  name?: string
  type?: string
  enabled: boolean
  models?: string[]
  enabledModels?: string[]
}

export interface AIGlobalModelsViewProps {
  config: SharedGlobalModelsConfig
  availableProviders: Record<string, AIProviderConfigInfo>
  onChange: (config: SharedGlobalModelsConfig) => void | Promise<void>
  onEmbeddingMigrationRequest?: (context: {
    oldModel: string
    newModel: string
    rollbackConfig: {
      globalEmbeddingProviderId: string
      globalEmbeddingModelId: string
      globalEmbeddingDimension: number
    }
  }) => Promise<boolean>
}

export const AIGlobalModelsView: React.FC<AIGlobalModelsViewProps> = ({
  config,
  availableProviders,
  onChange,
  onEmbeddingMigrationRequest
}) => {
  const { t } = useTranslation()
  const dialog = useDialog()

  // State to manage which model selector is currently open
  const [activeSelector, setActiveSelector] = useState<
    'dialogue' | 'naming' | 'summary' | 'embedding' | null
  >(null)

  // Filter provider arrays for the popup
  const getProvidersArray = (forEmbedding: boolean, forTts: boolean = false) => {
    return Object.values(availableProviders)
      .filter((p) => p.enabled && p.enabledModels && p.enabledModels.length > 0)
      .map((p) => {
        // Filter the models inside depending on whether they are embedding models, tts models, or other
        const validModels = (p.enabledModels || []).filter((m) => {
          const isEmbed = isEmbeddingModel(m)
          const isTts = isTtsModel(m)
          if (forEmbedding) return isEmbed
          if (forTts) return isTts
          return !isEmbed && !isTts
        })

        return {
          id: p.providerId,
          name: p.name || p.providerId,
          type: p.type || 'custom',
          models: p.models || [],
          enabledModels: validModels
        }
      })
      .filter((p) => p.enabledModels.length > 0)
  }

  const nonEmbeddingProviders = getProvidersArray(false)
  const embeddingProviders = getProvidersArray(true)

  const handleSelectModel = async (providerId: string, modelId: string) => {
    if (!activeSelector) return

    const newConfig = { ...config }

    if (activeSelector === 'embedding') {
      const currentProvider = config.globalEmbeddingProviderId
      const currentModel = config.globalEmbeddingModelId
      const isSwitching =
        currentProvider &&
        currentModel &&
        (currentProvider !== providerId || currentModel !== modelId)

      if (isSwitching) {
        setActiveSelector(null)

        const confirmed = await dialog.confirm(
          t(
            'agent.rag.migration_switch_warning_content',
            '新模型可能与现有向量不兼容，更换后将在后台重新嵌入日记数据。是否继续？'
          ),
          t('agent.rag.migration_switch_warning_title', '更换嵌入模型？')
        )
        if (!confirmed) {
          setActiveSelector('embedding')
          return
        }
      }

      newConfig.globalEmbeddingProviderId = providerId
      newConfig.globalEmbeddingModelId = modelId

      await Promise.resolve(onChange(newConfig))

      if (isSwitching && onEmbeddingMigrationRequest) {
        await onEmbeddingMigrationRequest({
          oldModel: `${currentProvider}:${currentModel}`,
          newModel: `${providerId}:${modelId}`,
          rollbackConfig: {
            globalEmbeddingProviderId: currentProvider,
            globalEmbeddingModelId: currentModel,
            globalEmbeddingDimension: config.globalEmbeddingDimension ?? 0
          }
        })
      }

      setActiveSelector(null)
      return
    } else if (activeSelector === 'dialogue') {
      newConfig.globalDialogueProviderId = providerId
      newConfig.globalDialogueModelId = modelId
    } else if (activeSelector === 'naming') {
      newConfig.globalNamingProviderId = providerId
      newConfig.globalNamingModelId = modelId
    } else if (activeSelector === 'summary') {
      newConfig.globalSummaryProviderId = providerId
      newConfig.globalSummaryModelId = modelId
    }

    await Promise.resolve(onChange(newConfig))
    setActiveSelector(null)
  }

  const renderSection = (
    key: 'dialogue' | 'naming' | 'summary' | 'embedding',
    title: string,
    icon: React.ReactNode,
    currentProvider: string,
    currentModel: string,
    isDanger: boolean = false
  ) => {
    const isModelSet = currentProvider && currentModel
    const providerName = availableProviders[currentProvider]?.name || currentProvider

    const getTooltipContent = () => {
      switch (key) {
        case 'summary':
          return t(
            'settings.tooltip_summary_model',
            '这个模型是用来生成周记、月报、季报、年鉴的模型，推荐用户选择最好的模型，这样生成出来的质量也会更好。'
          )
        case 'dialogue':
          return t('settings.tooltip_chat_model', '这是用来聊天的模型。')
        case 'naming':
          return t(
            'settings.tooltip_naming_model',
            '分配一个小体积轻量级模型，专门负责为你的每次对话写个标题以节约主力模型资源。'
          )
        case 'embedding':
          return t(
            'settings.tooltip_embedding_model',
            '它会在 AI 执行记忆存储（存储到 RAG 记忆中）的时候使用的模型。一旦日记发生变动，AI 也会用这个模型帮我们保存向量记忆。向量记忆相比于直接搜索的优点就是，它可以根据语义来进行近似搜索。'
          )
        default:
          return ''
      }
    }

    return (
      <div className={`${styles.routingCard} ${isDanger ? styles.dangerCard : ''}`}>
        <div className={styles.routeHeader}>
          <div className={`${styles.routeIcon} ${isDanger ? styles.dangerIcon : ''}`}>{icon}</div>
          <span className={`${styles.routeName} ${isDanger ? styles.dangerName : ''}`}>
            {title}
          </span>
          <HelpTooltip content={getTooltipContent()} className={styles.titleTooltip} size={16} />
        </div>

        <div
          className={`${styles.selectorBtn} ${isModelSet ? styles.hasValue : ''}`}
          onClick={() => setActiveSelector(key)}
        >
          {isModelSet ? (
            <div className={styles.selectedValueInfo}>
              <span className={styles.selectedProviderBadge}>{providerName}</span>
              <span className={styles.selectedModelName}>{currentModel}</span>
            </div>
          ) : (
            <div className={styles.placeholderText}>
              {t('models.click_to_assign', '点击分配默认处理模型')}
            </div>
          )}
          <span className={styles.dropdownIcon}>▼</span>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <div className={styles.headerRow}>
        <h2 className={styles.title}>{t('ai_config.global_models_title', '全局默认模型分配')}</h2>
      </div>

      <div className={styles.scrollArea}>
        <div className={styles.grid}>
          {renderSection(
            'summary',
            t('ai_config.summary_model_title', '长文推演总结'),
            <MdCompress size={22} />,
            config.globalSummaryProviderId,
            config.globalSummaryModelId
          )}

          {renderSection(
            'dialogue',
            t('ai_config.dialogue_model_title', '默认闲聊接管'),
            <MdChatBubbleOutline size={22} />,
            config.globalDialogueProviderId,
            config.globalDialogueModelId
          )}

          {renderSection(
            'naming',
            t('ai_config.naming_model_title', '对话提炼与命名'),
            <MdEdit size={22} />,
            config.globalNamingProviderId,
            config.globalNamingModelId
          )}

          {renderSection(
            'embedding',
            t('ai_config.embedding_model_title', 'RAG 向量映射层 (Embeddings)'),
            <MdHub size={22} />,
            config.globalEmbeddingProviderId,
            config.globalEmbeddingModelId,
            true
          )}
        </div>
      </div>

      {activeSelector && (
        <ModelSwitcherPopup
          providers={activeSelector === 'embedding' ? embeddingProviders : nonEmbeddingProviders}
          currentProviderId={
            activeSelector === 'dialogue'
              ? config.globalDialogueProviderId
              : activeSelector === 'naming'
                ? config.globalNamingProviderId
                : activeSelector === 'summary'
                  ? config.globalSummaryProviderId
                  : config.globalEmbeddingProviderId
          }
          currentModelId={
            activeSelector === 'dialogue'
              ? config.globalDialogueModelId
              : activeSelector === 'naming'
                ? config.globalNamingModelId
                : activeSelector === 'summary'
                  ? config.globalSummaryModelId
                  : config.globalEmbeddingModelId
          }
          onSelect={handleSelectModel}
          onClose={() => setActiveSelector(null)}
        />
      )}
    </div>
  )
}
