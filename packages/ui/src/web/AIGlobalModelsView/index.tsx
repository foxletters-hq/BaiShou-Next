import React from 'react';
import styles from './AIGlobalModelsView.module.css';
import { useTranslation } from 'react-i18next';
import { useDialog } from '../Dialog';

export interface GlobalModelsConfig {
  defaultChatModel: string;
  defaultVisionModel: string;
  defaultSummaryModel: string;
  defaultEmbeddingModel: string;
}

export interface AIProviderConfigInfo {
  providerId: string;
  enabled: boolean;
  models?: string[];
  enabledModels?: string[];
}

export interface AIGlobalModelsViewProps {
  config: GlobalModelsConfig;
  availableProviders: Record<string, AIProviderConfigInfo>;
  onChange: (config: GlobalModelsConfig) => void;
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

  const getSelectableModels = () => {
    const list: { id: string; providerName: string; modelName: string }[] = [];
    Object.values(availableProviders).forEach(provider => {
      if (provider.enabled && provider.enabledModels && provider.enabledModels.length > 0) {
         provider.enabledModels.forEach(m => {
            list.push({
              id: `${provider.providerId}:${m}`,
              providerName: provider.providerId,
              modelName: m,
            });
         });
      }
    });
    return list;
  };

  const selectableOptions = getSelectableModels();

  const handleFieldChange = async (field: keyof GlobalModelsConfig, val: string) => {
    if (field === 'defaultEmbeddingModel' && val !== config.defaultEmbeddingModel) {
      if (config.defaultEmbeddingModel) {
        const confirmed = await dialog.confirm(
          t('models.embedding_warning', '【高危险警告: 向量库脱节】\n您尝试将系统核心嵌入模型从 {{old}} 切换到 {{new}}。旧有记忆将可能作废，需要进入重新推导演算程序。\n点击确认应用', {old: config.defaultEmbeddingModel, new: val})
        );
        if (!confirmed) return;
        
        if (onEmbeddingMigrationRequest) {
          const migrationPass = await onEmbeddingMigrationRequest(config.defaultEmbeddingModel, val);
          if (!migrationPass) return;
        }
      }
    }
    onChange({ ...config, [field]: val });
  };

  const renderSelect = (fieldKey: keyof GlobalModelsConfig, placeholder: string) => {
    return (
      <select 
         className={styles.routeSelect}
         value={config[fieldKey] || ''}
         onChange={(e) => handleFieldChange(fieldKey, e.target.value)}
      >
        <option value="" disabled>--- {placeholder} ---</option>
        {selectableOptions.length === 0 && (
           <option value="" disabled>{t('models.no_active_model', '当前没有激活可用的模型，请前往服务商处获取')}</option>
        )}
        {selectableOptions.map(opt => (
           <option key={opt.id} value={opt.id}>
             {opt.providerName} / {opt.modelName}
           </option>
        ))}
      </select>
    );
  }

  return (
    <div className={styles.container}>
      <h3 className={styles.headerTitle}>{t('models.routing_title', '全局默认模型配置')}</h3>
      <p className={styles.headerSubtitle}>
        {t('models.routing_desc', '允许为不同专业领域调派并指定默认模型。')}
      </p>

      <div className={styles.grid}>
        
        {/* Summary Model (长文总结模块) */}
        <div className={styles.routingCard}>
          <div className={styles.routeHeader}>
            <div className={styles.routeIcon}>📑</div>
            <span className={styles.routeName}>{t('ai_config.summary_model_title', '长文总结模块 (Summarizer)')}</span>
          </div>
          {renderSelect('defaultSummaryModel', '选择专长文本压栈概括的模型')}
          <div className={styles.routeDesc}>{t('ai_config.summary_model_desc', '负责将长文压缩或进行超文本报告总结工作。')}</div>
        </div>

        {/* Chat Model (默认对话核心) */}
        <div className={styles.routingCard}>
          <div className={styles.routeHeader}>
            <div className={styles.routeIcon}>💬</div>
            <span className={styles.routeName}>{t('ai_config.dialogue_model_title', '默认对话核心 (Dialogue Model)')}</span>
          </div>
          {renderSelect('defaultChatModel', '选择首选闲聊问答模型')}
          <div className={styles.routeDesc}>{t('ai_config.dialogue_model_desc', '负责普通的基础推测对答。')}</div>
        </div>

        {/* Vision / Naming Model (视觉命名推断 - we had Vison/Naming) */}
        <div className={styles.routingCard}>
          <div className={styles.routeHeader}>
            <div className={styles.routeIcon}>👁️</div>
            <span className={styles.routeName}>{t('ai_config.vision_model_title', '核心视觉理解 (Vision Input)')}</span>
          </div>
          {renderSelect('defaultVisionModel', '指定视觉输入模型')}
          <div className={styles.routeDesc}>{t('ai_config.vision_model_desc', '负责多模态文件的深度图片解析处理和理解。')}</div>
        </div>

        {/* Embedding Model */}
        <div className={`${styles.routingCard} ${styles.routingCardDanger}`}>
          <div className={styles.routeHeader}>
            <div className={`${styles.routeIcon} ${styles.dangerIcon}`}>🔢</div>
            <span className={`${styles.routeName} ${styles.dangerName}`}>{t('ai_config.embedding_model_title', '向量嵌入模型 (Embeddings)')}</span>
          </div>
          {renderSelect('defaultEmbeddingModel', '分配文本映射成特征算子的核模型')}
          <div className={styles.routeDesc}>{t('ai_config.embedding_model_desc', '构建检索记忆的关键特征。发生底层迁移时必定触怒 RAG 重建机制，请慎重对待。')}</div>
        </div>

      </div>
    </div>
  );
};
