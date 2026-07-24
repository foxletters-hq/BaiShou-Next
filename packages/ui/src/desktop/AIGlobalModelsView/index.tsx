import React, { useState } from 'react'
import styles from './AIGlobalModelsView.module.css'
import { useTranslation } from 'react-i18next'
import { useDialog } from '../Dialog'
import { ModelSwitcherPopup } from '../ModelSwitcherPopup'
import {
  GlobalModelsConfig as SharedGlobalModelsConfig,
  isEmbeddingModel,
  isTtsModel
} from '@baishou/shared'
import { Database, Cloud, MessageCircle, Pencil, ScrollText, Waypoints } from 'lucide-react'
import { HelpTooltip } from '../HelpTooltip'
import { SettingsPageChrome } from '../shared/SettingsPageChrome'
import stack from '../shared/SettingsStack.module.css'
import { useTheme } from '../../hooks/useTheme'
import { getProviderIcon } from '../../utils/provider-icons'

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
  onManageProviders?: () => void
  /** 页面下方附加区块（如系统核心设定） */
  footer?: React.ReactNode
}

type ModelSelectorKey = 'dialogue' | 'naming' | 'summary' | 'embedding'

export const AIGlobalModelsView: React.FC<AIGlobalModelsViewProps> = ({
  config,
  availableProviders,
  onChange,
  onEmbeddingMigrationRequest,
  onManageProviders,
  footer
}) => {
  const { t } = useTranslation()
  const dialog = useDialog()
  const { isDark } = useTheme()

  const [activeSelector, setActiveSelector] = useState<ModelSelectorKey | null>(null)

  const getProvidersArray = (forEmbedding: boolean, forTts: boolean = false) => {
    return Object.values(availableProviders)
      .filter((p) => p.enabled && p.enabledModels && p.enabledModels.length > 0)
      .map((p) => {
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
      // 图关系抽取始终跟随对话模型
      newConfig.globalGraphProviderId = providerId
      newConfig.globalGraphModelId = modelId
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
    key: ModelSelectorKey | 'graph',
    title: string,
    icon: React.ReactNode,
    currentProvider: string,
    currentModel: string,
    options: { isDanger?: boolean; readOnly?: boolean } = {}
  ) => {
    const { isDanger = false, readOnly = false } = options
    const isModelSet = Boolean(currentProvider && currentModel)
    const providerMeta = availableProviders[currentProvider]
    const providerIconUrl =
      getProviderIcon(currentProvider, isDark) ||
      (providerMeta?.type ? getProviderIcon(providerMeta.type, isDark) : undefined)

    const getTooltipContent = () => {
      switch (key) {
        case 'summary':
          return t(
            'settings.tooltip_summary_model',
            '这个模型是用来生成周记、月报、季报、年鉴的模型，推荐用户选择最好的模型，这样生成出来的质量也会更好。'
          )
        case 'dialogue':
          return t('settings.tooltip_chat_model', '这是用来聊天的模型。')
        case 'graph':
          return t(
            'settings.tooltip_graph_model',
            '用于梳理日记中的人物、事件与关系（图关系抽取）。始终与默认对话模型保持一致，不可单独修改。'
          )
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
          className={`${styles.selectorBtn} ${isModelSet ? styles.hasValue : ''} ${
            readOnly ? styles.selectorBtnReadonly : ''
          }`}
          onClick={
            readOnly || key === 'graph'
              ? undefined
              : () => setActiveSelector(key as ModelSelectorKey)
          }
          aria-disabled={readOnly}
        >
          {isModelSet ? (
            <div className={styles.selectedValueInfo}>
              <span className={styles.selectedProviderIcon} aria-hidden>
                {providerIconUrl ? <img src={providerIconUrl} alt="" /> : <Cloud size={18} />}
              </span>
              <span className={styles.selectedModelName}>{currentModel}</span>
            </div>
          ) : (
            <div className={styles.placeholderText}>
              {readOnly
                ? t('settings.not_set', '未设置')
                : t('models.click_to_assign', '点击分配默认处理模型')}
            </div>
          )}
          {!readOnly && <span className={styles.dropdownIcon}>▼</span>}
        </div>
      </div>
    )
  }

  const currentProviderForSelector = (): string => {
    switch (activeSelector) {
      case 'dialogue':
        return config.globalDialogueProviderId
      case 'naming':
        return config.globalNamingProviderId
      case 'summary':
        return config.globalSummaryProviderId
      case 'embedding':
        return config.globalEmbeddingProviderId
      default:
        return ''
    }
  }

  const currentModelForSelector = (): string => {
    switch (activeSelector) {
      case 'dialogue':
        return config.globalDialogueModelId
      case 'naming':
        return config.globalNamingModelId
      case 'summary':
        return config.globalSummaryModelId
      case 'embedding':
        return config.globalEmbeddingModelId
      default:
        return ''
    }
  }

  return (
    <SettingsPageChrome title={t('ai_config.global_models_title', '全局默认模型分配')}>
      <div className={stack.stack}>
        <div className={styles.grid}>
          {renderSection(
            'summary',
            t('ai_config.summary_model_title', '长文推演总结'),
            <ScrollText size={22} />,
            config.globalSummaryProviderId,
            config.globalSummaryModelId
          )}

          {renderSection(
            'dialogue',
            t('ai_config.dialogue_model_title', '默认对话模型'),
            <MessageCircle size={22} />,
            config.globalDialogueProviderId,
            config.globalDialogueModelId
          )}

          {renderSection(
            'graph',
            t('ai_config.graph_model_title', '图关系抽取模型'),
            <Waypoints size={22} />,
            config.globalDialogueProviderId,
            config.globalDialogueModelId,
            { readOnly: true }
          )}

          {renderSection(
            'naming',
            t('ai_config.naming_model_title', '对话提炼与命名'),
            <Pencil size={22} />,
            config.globalNamingProviderId,
            config.globalNamingModelId
          )}

          {renderSection(
            'embedding',
            t('ai_config.embedding_model_title', 'RAG 向量映射层 (Embeddings)'),
            <Database size={22} />,
            config.globalEmbeddingProviderId,
            config.globalEmbeddingModelId,
            { isDanger: true }
          )}
        </div>

        {footer}
      </div>

      {activeSelector && (
        <ModelSwitcherPopup
          providers={activeSelector === 'embedding' ? embeddingProviders : nonEmbeddingProviders}
          currentProviderId={currentProviderForSelector()}
          currentModelId={currentModelForSelector()}
          onSelect={handleSelectModel}
          onClose={() => setActiveSelector(null)}
          onManageProviders={onManageProviders}
        />
      )}
    </SettingsPageChrome>
  )
}
