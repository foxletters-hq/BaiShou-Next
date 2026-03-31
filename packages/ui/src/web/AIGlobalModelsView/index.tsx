import React from 'react';
import styles from './AIGlobalModelsView.module.css';

export interface GlobalModelsConfig {
  defaultChatModel: string;
  defaultVisionModel: string;
  defaultSummaryModel: string;
  defaultEmbeddingModel: string;
}

interface AIGlobalModelsViewProps {
  config: GlobalModelsConfig;
  onChange: (config: GlobalModelsConfig) => void;
}

// 这里简单模拟全局可选模型的格式，供表单输入或选择
export const AIGlobalModelsView: React.FC<AIGlobalModelsViewProps> = ({ config, onChange }) => {
  const updateField = (field: keyof GlobalModelsConfig, val: string) => {
    onChange({ ...config, [field]: val });
  };

  return (
    <div className={styles.container}>
      <h3 className={styles.headerTitle}>全局算力集群派遣分流 (Routing)</h3>
      <p className={styles.headerSubtitle}>
        白守会在不同的专业领域调派最适合的模型子节点。请使用 `provider:model_name` 格式进行绑定，如 <code>openai:gpt-4o</code>。
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
          <input 
            className={styles.routeInput}
            value={config.defaultChatModel}
            onChange={(e) => updateField('defaultChatModel', e.target.value)}
            placeholder="如: deepseek:deepseek-chat"
          />
        </div>

        {/* Vision Model */}
        <div className={styles.routingCard}>
          <div className={styles.routeHeader}>
            <div className={styles.routeIcon}>👁️</div>
            <div className={styles.routeMeta}>
              <span className={styles.routeName}>视觉中枢 (Vision Analysis)</span>
              <span className={styles.routeDesc}>负责对图像输入做基于光学意图的深度解析。</span>
            </div>
          </div>
          <input 
            className={styles.routeInput}
            value={config.defaultVisionModel}
            onChange={(e) => updateField('defaultVisionModel', e.target.value)}
            placeholder="如: openai:gpt-4o"
          />
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
          <input 
            className={styles.routeInput}
            value={config.defaultSummaryModel}
            onChange={(e) => updateField('defaultSummaryModel', e.target.value)}
            placeholder="如: kimi:moonshot-v1-32k"
          />
        </div>

        {/* Embedding Model */}
        <div className={styles.routingCard}>
          <div className={styles.routeHeader}>
            <div className={styles.routeIcon}>🔢</div>
            <div className={styles.routeMeta}>
              <span className={styles.routeName}>向量嵌入引擎 (Embeddings)</span>
              <span className={styles.routeDesc}>极高频转换。一旦设定，切忌随意更改，否则向量库会塌陷！</span>
            </div>
          </div>
          <input 
            className={styles.routeInput}
            value={config.defaultEmbeddingModel}
            onChange={(e) => updateField('defaultEmbeddingModel', e.target.value)}
            placeholder="如: ollama:nomic-embed-text"
          />
        </div>

      </div>
    </div>
  );
};
