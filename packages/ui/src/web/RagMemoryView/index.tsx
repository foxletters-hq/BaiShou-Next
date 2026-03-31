import React from 'react';
import styles from './RagMemoryView.module.css';

export interface RagConfig {
  topK: number;
  similarityThreshold: number;
  maxTokensLimit: number;
}

interface RagMemoryViewProps {
  config: RagConfig;
  onChange: (config: RagConfig) => void;
}

export const RagMemoryView: React.FC<RagMemoryViewProps> = ({ config, onChange }) => {
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.titleInfo}>
          <h3 className={styles.title}>神经网格调优 (RAG Parameters)</h3>
          <p className={styles.subtitle}>精密控制外挂知识点与切片的召回尺度、下潜深度。</p>
        </div>
      </div>

      <div className={styles.grid}>
        <div className={styles.paramCard}>
          <div className={styles.paramHeader}>
            <span className={styles.paramTitle}>Top-K 切片召回数量</span>
            <span className={styles.paramValue}>{config.topK} 枚</span>
          </div>
          <p className={styles.paramDesc}>每一次用户询问激活多少个最相关的本地私知切片喂入大模型？（越高越详尽，但开销越大）</p>
          <input 
            type="range" 
            className={styles.rangeInput}
            min="1" max="50" step="1"
            value={config.topK}
            onChange={(e) => onChange({ ...config, topK: parseInt(e.target.value) })}
          />
        </div>

        <div className={styles.paramCard}>
          <div className={styles.paramHeader}>
            <span className={styles.paramTitle}>严谨度阀限 (Similarity)</span>
            <span className={styles.paramValue}>{config.similarityThreshold.toFixed(2)}</span>
          </div>
          <p className={styles.paramDesc}>拒接一切余弦相似度低于此值的关联段落。（0.0 全盘接受，1.0 必须词不差）</p>
          <input 
            type="range" 
            className={styles.rangeInput}
            min="0" max="1" step="0.05"
            value={config.similarityThreshold}
            onChange={(e) => onChange({ ...config, similarityThreshold: parseFloat(e.target.value) })}
          />
        </div>

        <div className={styles.paramCard}>
          <div className={styles.paramHeader}>
            <span className={styles.paramTitle}>极限界流 (Max Tokens)</span>
            <span className={styles.paramValue}>{config.maxTokensLimit} tk</span>
          </div>
          <p className={styles.paramDesc}>为防止内存爆栈或超量计费，限制单次组合向量文本的最大体积长度。</p>
          <input 
            type="range" 
            className={styles.rangeInput}
            min="500" max="100000" step="500"
            value={config.maxTokensLimit}
            onChange={(e) => onChange({ ...config, maxTokensLimit: parseInt(e.target.value) })}
          />
        </div>
      </div>
    </div>
  );
};
