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

// 这里复用前一个组件的数据结构接口定义
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
  // 生成可用的模型下拉清单对象 "providerId:modelId"
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
    // 对 Embedding 设置一个特殊的防卫机制
    if (field === 'defaultEmbeddingModel' && val !== config.defaultEmbeddingModel) {
      if (config.defaultEmbeddingModel) {
        // 如果旧的引擎存在，弹出高危替换提示
        const confirmed = await dialog.confirm(
          t('models.embedding_warning', '【高危险警告: 向量库脱节】\n您尝试将系统核心嵌入模型从 {{old}} 切换到 {{new}}。旧有记忆将可能作废，需要进入重新推导演算程序。\n点击确认应用', {old: config.defaultEmbeddingModel, new: val})
        );
        if (!confirmed) return; // 拦截
        
        // 尝试通报父容器进行重算
        if (onEmbeddingMigrationRequest) {
          const migrationPass = await onEmbeddingMigrationRequest(config.defaultEmbeddingModel, val);
          if (!migrationPass) return; // 后台决断为不再继续
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
      <h3 className={styles.headerTitle}>{t('models.routing_title', '全局默认模型分流 (Routing)')}</h3>
      <p className={styles.headerSubtitle}>
        {t('models.routing_desc', '白守会在不同的专业领域调派最适合的模型。所有模型选项皆采自从您的模型服务中心启用的名单。')}
      </p>

      <div className={styles.grid}>
        
        {/* Chat Model */}
        <div className={styles.routingCard}>
          <div className={styles.routeHeader}>
            <div className={styles.routeIcon}>💬</div>
            <div className={styles.routeMeta}>
              <span className={styles.routeName}>{t('models.route_chat', '默认对话核心 (Chat & Main)')}</span>
              <span className={styles.routeDesc}>{t('models.route_chat_desc', '负责普通流式文本对答与基础推理。')}</span>
            </div>
          </div>
          {renderSelect('defaultChatModel', '选择一个旗舰对话模型...')}
        </div>

        {/* Vision Model */}
        <div className={styles.routingCard}>
          <div className={styles.routeHeader}>
            <div className={styles.routeIcon}>👁️</div>
            <div className={styles.routeMeta}>
              <span className={styles.routeName}>{t('models.route_vision', '视觉分析验证 (Vision)')}</span>
              <span className={styles.routeDesc}>{t('models.route_vision_desc', '负责对图像输入做深度解析。若要识别图像，必须选中多模态版本模型。')}</span>
            </div>
          </div>
          {renderSelect('defaultVisionModel', '选择一个多模态视觉模型...')}
        </div>

        {/* Summary Model */}
        <div className={styles.routingCard}>
          <div className={styles.routeHeader}>
            <div className={styles.routeIcon}>📑</div>
            <div className={styles.routeMeta}>
              <span className={styles.routeName}>{t('models.route_summarizer', '长文总结模块 (Summarizer)')}</span>
              <span className={styles.routeDesc}>{t('models.route_summarizer_desc', '负责将长文压缩或进行日记报告总结。')}</span>
            </div>
          </div>
          {renderSelect('defaultSummaryModel', '选择专长文本吞吐的模型...')}
        </div>

        {/* Embedding Model */}
        <div className={`${styles.routingCard} ${styles.routingCardDanger}`}>
          <div className={styles.routeHeader}>
            <div className={`${styles.routeIcon} ${styles.dangerIcon}`}>🔢</div>
            <div className={styles.routeMeta}>
              <span className={`${styles.routeName} ${styles.dangerName}`}>{t('models.route_embeddings', '向量嵌入模型 (Embeddings)')}</span>
              <span className={styles.routeDesc}>{t('models.route_embeddings_desc', '构建检索记忆的关键特征。由于更改将导致过往本地索引失效，更换请务必慎重。')}</span>
            </div>
          </div>
          {renderSelect('defaultEmbeddingModel', '高危：选择并绑定特征算计算子...')}
        </div>

      </div>
    </div>
  );
};
