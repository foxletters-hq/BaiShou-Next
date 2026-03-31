import React from 'react';
import styles from './AIGlobalModelsView.module.css';

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
        const confirmed = window.confirm(
          `【高危警告: 向量塌陷风险】\n您正在尝试切换系统的脑部索引神经元，从 ${config.defaultEmbeddingModel} 换为 ${val}。\n这会导致您之前记录的所有上下文、日记将永久无法被新的神经网络读取，需要进行漫长的全盘向量重算！\n\n点击【确认】以承受风险并变更。`
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
           <option value="" disabled>当前没有激活可用的模型，请前往服务商处获取</option>
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
      <h3 className={styles.headerTitle}>全局算力集群派遣分流 (Routing)</h3>
      <p className={styles.headerSubtitle}>
        白守会在不同的专业领域调派最适合的模型子节点。所有模型选项皆采自从您的【大模型服务集成端】中启用的名单。
      </p>

      <div className={styles.grid}>
        
        {/* Chat Model */}
        <div className={styles.routingCard}>
          <div className={styles.routeHeader}>
            <div className={styles.routeIcon}>💬</div>
            <div className={styles.routeMeta}>
              <span className={styles.routeName}>逻辑智核 (Chat & Main)</span>
              <span className={styles.routeDesc}>负责高并发的流式文本对答与思维链推理。</span>
            </div>
          </div>
          {renderSelect('defaultChatModel', '选择一个旗舰对话模型...')}
        </div>

        {/* Vision Model */}
        <div className={styles.routingCard}>
          <div className={styles.routeHeader}>
            <div className={styles.routeIcon}>👁️</div>
            <div className={styles.routeMeta}>
              <span className={styles.routeName}>视觉中枢 (Vision Analysis)</span>
              <span className={styles.routeDesc}>负责对图像输入做基于光学意图的深度解析。建议选中多模态版本。</span>
            </div>
          </div>
          {renderSelect('defaultVisionModel', '选择一个多模态视觉模型...')}
        </div>

        {/* Summary Model */}
        <div className={styles.routingCard}>
          <div className={styles.routeHeader}>
            <div className={styles.routeIcon}>📑</div>
            <div className={styles.routeMeta}>
              <span className={styles.routeName}>归档摘要机 (Summarizer)</span>
              <span className={styles.routeDesc}>负责将长文无损压缩，要求极高的上下文容量与速读。</span>
            </div>
          </div>
          {renderSelect('defaultSummaryModel', '选择专长文本吞吐的模型...')}
        </div>

        {/* Embedding Model */}
        <div className={`${styles.routingCard} ${styles.routingCardDanger}`}>
          <div className={styles.routeHeader}>
            <div className={`${styles.routeIcon} ${styles.dangerIcon}`}>🔢</div>
            <div className={styles.routeMeta}>
              <span className={`${styles.routeName} ${styles.dangerName}`}>向量嵌入引擎 (Embeddings)</span>
              <span className={styles.routeDesc}>极高频特征。一旦设定将切忌随意更改，否则导致知识库孤岛化！推荐本地计算模型。</span>
            </div>
          </div>
          {renderSelect('defaultEmbeddingModel', '高危：选择并绑定特征算计算子...')}
        </div>

      </div>
    </div>
  );
};
