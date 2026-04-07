import React, { useState } from 'react';
import styles from './AIGlobalModelsView.module.css';
import { useTranslation } from 'react-i18next';
import { useDialog } from '../Dialog';
import { ModelSwitcherPopup } from '../ModelSwitcherPopup';
import { GlobalModelsConfig, GlobalModelsConfig as SharedGlobalModelsConfig } from '@baishou/shared';
import { isEmbeddingModel } from '@baishou/shared';
import { MdChatBubbleOutline, MdCompress, MdEdit, MdHub } from 'react-icons/md';

export interface AIProviderConfigInfo {
  providerId: string;
  name?: string;
  type?: string;
  enabled: boolean;
  models?: string[];
  enabledModels?: string[];
}

export interface AIGlobalModelsViewProps {
  config: SharedGlobalModelsConfig;
  availableProviders: Record<string, AIProviderConfigInfo>;
  onChange: (config: SharedGlobalModelsConfig) => void;
  onEmbeddingMigrationRequest?: (oldModel: string, newModel: string) => Promise<boolean>;
}

export const AIGlobalModelsView: React.FC<AIGlobalModelsViewProps> = ({ 
  config, 
  availableProviders, 
  onChange,
  onEmbeddingMigrationRequest
}) => {
  const { t } = useTranslation();
  const dialog = useDialog();

  // State to manage which model selector is currently open
  const [activeSelector, setActiveSelector] = useState<'dialogue' | 'naming' | 'summary' | 'embedding' | null>(null);

  // Filter provider arrays for the popup
  const getProvidersArray = (forEmbedding: boolean) => {
    return Object.values(availableProviders)
      .filter(p => p.enabled && p.enabledModels && p.enabledModels.length > 0)
      .map(p => {
        // Filter the models inside depending on whether they are embedding models or not
        const validModels = (p.enabledModels || []).filter(m => {
          const isEmbed = isEmbeddingModel(m);
          return forEmbedding ? isEmbed : !isEmbed;
        });

        return {
          id: p.providerId,
          name: p.name || p.providerId,
          type: p.type || 'custom',
          models: p.models || [],
          enabledModels: validModels
        };
      })
      .filter(p => p.enabledModels.length > 0);
  };

  const nonEmbeddingProviders = getProvidersArray(false);
  const embeddingProviders = getProvidersArray(true);

  const handleSelectModel = async (providerId: string, modelId: string) => {
    if (!activeSelector) return;
    
    const newConfig = { ...config };

    if (activeSelector === 'embedding') {
      const currentProvider = config.globalEmbeddingProviderId;
      const currentModel = config.globalEmbeddingModelId;
      const isSwitching = (currentProvider && currentModel) && (currentProvider !== providerId || currentModel !== modelId);

      if (isSwitching) {
        const confirmed = await dialog.confirm(
          t('agent.rag.migration_switch_warning_title', '【警告】变更嵌入引擎\n'),
          t('agent.rag.migration_switch_warning_content', '您正试图切换底层的向量嵌入(Embedding)引擎。\n因为不同模型产生的向量维度极大概率互不兼容，这可能需要使应用对已有的所有文件重新进行特征映射计算（完全重新建立知识库）。这是极耗资源的操作。您确定仍要继续吗？')
        );
        if (!confirmed) {
          setActiveSelector(null);
          return;
        }

        if (onEmbeddingMigrationRequest) {
           const allowed = await onEmbeddingMigrationRequest(`${currentProvider}:${currentModel}`, `${providerId}:${modelId}`);
           if (!allowed) {
              setActiveSelector(null);
              return;
           }
        }
      }

      newConfig.globalEmbeddingProviderId = providerId;
      newConfig.globalEmbeddingModelId = modelId;
    } else if (activeSelector === 'dialogue') {
      newConfig.globalDialogueProviderId = providerId;
      newConfig.globalDialogueModelId = modelId;
    } else if (activeSelector === 'naming') {
      newConfig.globalNamingProviderId = providerId;
      newConfig.globalNamingModelId = modelId;
    } else if (activeSelector === 'summary') {
      newConfig.globalSummaryProviderId = providerId;
      newConfig.globalSummaryModelId = modelId;
    }

    onChange(newConfig);
    setActiveSelector(null);
  };

  const renderSection = (
    key: 'dialogue' | 'naming' | 'summary' | 'embedding',
    title: string,
    desc: string,
    icon: React.ReactNode,
    currentProvider: string,
    currentModel: string,
    isDanger: boolean = false
  ) => {
    const isModelSet = currentProvider && currentModel;
    const providerName = availableProviders[currentProvider]?.name || currentProvider;

    return (
      <div className={`${styles.routingCard} ${isDanger ? styles.dangerCard : ''}`}>
        <div className={styles.routeHeader}>
          <div className={`${styles.routeIcon} ${isDanger ? styles.dangerIcon : ''}`}>{icon}</div>
          <span className={`${styles.routeName} ${isDanger ? styles.dangerName : ''}`}>{title}</span>
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

        <div className={styles.routeDesc}>{desc}</div>
      </div>
    )
  };

  return (
    <div className={styles.container}>
      <h2 className={styles.headerTitle}>{t('ai_config.global_models_title', '全局默认模型分配')}</h2>
      <p className={styles.headerSubtitle}>
        {t('models.routing_desc', '允许为您日常面对的不同维度的复杂任务，挂载不同的专长模型。')}
      </p>

      <div className={styles.grid}>
        {renderSection(
          'summary', 
          t('ai_config.summary_model_title', '长文推演总结'), 
          t('ai_config.summary_model_desc', '处理文章和报告时优先调用的默认模型。'), 
          <MdCompress size={22} />, 
          config.globalSummaryProviderId, 
          config.globalSummaryModelId
        )}

        {renderSection(
          'dialogue', 
          t('ai_config.dialogue_model_title', '默认闲聊接管'), 
          t('ai_config.dialogue_model_desc', '当没有指派特殊模型时，默认与您进行对答的灵魂引擎。'), 
          <MdChatBubbleOutline size={22} />, 
          config.globalDialogueProviderId, 
          config.globalDialogueModelId
        )}

        {renderSection(
          'naming', 
          t('ai_config.naming_model_title', '对话提炼与命名'), 
          t('ai_config.naming_model_desc', '为了节约主力模型的计算资源，可以分配一个小体积轻量级模型专门负责为你的每次对话写个标题。'), 
          <MdEdit size={22} />, 
          config.globalNamingProviderId, 
          config.globalNamingModelId
        )}

        {renderSection(
          'embedding', 
          t('ai_config.embedding_model_title', 'RAG 向量映射层 (Embeddings)'), 
          t('ai_config.embedding_model_desc', '为你的本地文件建立向量空间映射的核心引擎。替换模型可能导致之前的所有知识库瘫痪并需要重新挂载索引运算！'), 
          <MdHub size={22} />, 
          config.globalEmbeddingProviderId, 
          config.globalEmbeddingModelId,
          true
        )}
      </div>

      {activeSelector && (
        <ModelSwitcherPopup
          providers={activeSelector === 'embedding' ? embeddingProviders : nonEmbeddingProviders}
          currentProviderId={
            activeSelector === 'dialogue' ? config.globalDialogueProviderId :
            activeSelector === 'naming' ? config.globalNamingProviderId :
            activeSelector === 'summary' ? config.globalSummaryProviderId :
            config.globalEmbeddingProviderId
          }
          currentModelId={
            activeSelector === 'dialogue' ? config.globalDialogueModelId :
            activeSelector === 'naming' ? config.globalNamingModelId :
            activeSelector === 'summary' ? config.globalSummaryModelId :
            config.globalEmbeddingModelId
          }
          onSelect={handleSelectModel}
          onClose={() => setActiveSelector(null)}
        />
      )}
    </div>
  );
};
