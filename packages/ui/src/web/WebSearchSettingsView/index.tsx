import React from 'react';
import styles from './WebSearchSettingsView.module.css';

export interface WebSearchConfig {
  enabled: boolean;
  searchEngine: 'duckduckgo' | 'google' | 'bing' | 'tavily' | 'jina';
  searchResultLimit: number;
}

export interface SummaryConfig {
  autoSummarizeThreshold: number;
  summarizeMethod: 'extract' | 'abstract';
}

interface WebSearchSettingsViewProps {
  searchConfig: WebSearchConfig;
  summaryConfig: SummaryConfig;
  onSearchChange: (config: WebSearchConfig) => void;
  onSummaryChange: (config: SummaryConfig) => void;
}

export const WebSearchSettingsView: React.FC<WebSearchSettingsViewProps> = ({
  searchConfig,
  summaryConfig,
  onSearchChange,
  onSummaryChange
}) => {
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.titleInfo}>
          <h3 className={styles.title}>神经网搜与长文归纳控制台</h3>
          <p className={styles.subtitle}>管控大模型主动爬取万维网时的嗅探引擎，及长篇文书的预处理归卷策略。</p>
        </div>
      </div>

      <div className={styles.cardSection}>
        <div className={styles.cardHeader}>
          <div className={styles.cardTitleLine}>
            <span>🌐 万维网神经探针 (Web Search)</span>
            <label className={styles.switch}>
              <input 
                type="checkbox" 
                checked={searchConfig.enabled}
                onChange={(e) => onSearchChange({ ...searchConfig, enabled: e.target.checked })}
              />
              <span className={styles.slider}></span>
            </label>
          </div>
          <p className={styles.cardDesc}>赋予 AI 随时绕过沙箱，直接访问互联网读取实时新闻或资料集的能力。</p>
        </div>

        <div className={styles.cardBody} style={{ opacity: searchConfig.enabled ? 1 : 0.4 }}>
          <div className={styles.row}>
            <label className={styles.label}>底盘检索引擎</label>
            <select 
              className={styles.selectBox}
              value={searchConfig.searchEngine}
              disabled={!searchConfig.enabled}
              onChange={(e) => onSearchChange({ ...searchConfig, searchEngine: e.target.value as any })}
            >
              <option value="duckduckgo">DuckDuckGo (无需密钥 / 隐匿追踪)</option>
              <option value="tavily">Tavily (专业级 AI 信息收割)</option>
              <option value="jina">Jina Reader (强力页面清洗器)</option>
              <option value="google">Google API (经典精准)</option>
              <option value="bing">Bing Search (实时强悍)</option>
            </select>
          </div>
          
          <div className={styles.row}>
            <label className={styles.label}>截取引用数阈值</label>
            <div className={styles.sliderWrapper}>
               <input 
                 type="range" 
                 min="1" max="15" step="1"
                 disabled={!searchConfig.enabled}
                 className={styles.rangeInput}
                 value={searchConfig.searchResultLimit}
                 onChange={(e) => onSearchChange({ ...searchConfig, searchResultLimit: parseInt(e.target.value) })}
               />
               <span className={styles.valBadge}>{searchConfig.searchResultLimit} 条</span>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.cardSection}>
         <div className={styles.cardHeader}>
           <div className={styles.cardTitleLine}>
             <span>📑 大部头典籍压缩器 (Summarizer)</span>
           </div>
           <p className={styles.cardDesc}>防止冗长无用的垃圾信息塞爆您的显存或消耗海量 API Token 计费。</p>
         </div>

         <div className={styles.cardBody}>
           <div className={styles.row}>
             <label className={styles.label}>自动压缩触发线 (Threshold)</label>
             <div className={styles.sliderWrapper}>
               <input 
                 type="range" 
                 min="1000" max="64000" step="1000"
                 className={styles.rangeInputColored}
                 value={summaryConfig.autoSummarizeThreshold}
                 onChange={(e) => onSummaryChange({ ...summaryConfig, autoSummarizeThreshold: parseInt(e.target.value) })}
               />
               <span className={styles.valBadge}>{summaryConfig.autoSummarizeThreshold} 字</span>
             </div>
           </div>

           <div className={styles.row}>
             <label className={styles.label}>坍缩归纳心法</label>
             <select 
               className={styles.selectBox}
               value={summaryConfig.summarizeMethod}
               onChange={(e) => onSummaryChange({ ...summaryConfig, summarizeMethod: e.target.value as any })}
             >
               <option value="extract">抽取式 (Extract) - 原汁原味抽取关键句，保留文本指纹</option>
               <option value="abstract">生成式 (Abstract) - 彻底打碎后经由专属分析大模型重写大纲 (消耗算力)</option>
             </select>
           </div>
         </div>
      </div>

    </div>
  );
};
