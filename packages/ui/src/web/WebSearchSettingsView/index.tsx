import React from 'react';
import styles from './WebSearchSettingsView.module.css';
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation();
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.titleInfo}>
          <h3 className={styles.title}>{t('settings.web_search_config_title', '网络搜索与长文归纳')}</h3>
          <p className={styles.subtitle}>{t('settings.web_search_config_desc', '管理网络检索引擎及长文本内容的预处理策略。')}</p>
        </div>
      </div>

      <div className={styles.cardSection}>
        <div className={styles.cardHeader}>
          <div className={styles.cardTitleLine}>
            <span>🌐 {t('settings.web_search_title', '网络搜索 (Web Search)')}</span>
            <label className={styles.switch}>
              <input 
                type="checkbox" 
                checked={searchConfig.enabled}
                onChange={(e) => onSearchChange({ ...searchConfig, enabled: e.target.checked })}
              />
              <span className={styles.slider}></span>
            </label>
          </div>
          <p className={styles.cardDesc}>{t('settings.web_search_desc', '允许 AI 访问互联网以读取最新资料库。')}</p>
        </div>

        <div className={styles.cardBody} style={{ opacity: searchConfig.enabled ? 1 : 0.4 }}>
          <div className={styles.row}>
            <label className={styles.label}>{t('settings.web_search_engine_label', '搜索引擎')}</label>
            <select 
              className={styles.selectBox}
              value={searchConfig.searchEngine}
              disabled={!searchConfig.enabled}
              onChange={(e) => onSearchChange({ ...searchConfig, searchEngine: e.target.value as any })}
            >
              <option value="duckduckgo">{t('settings.web_search_engine_duckduckgo', 'DuckDuckGo')}</option>
              <option value="tavily">{t('settings.web_search_engine_tavily', 'Tavily API')}</option>
              <option value="jina">{t('settings.web_search_engine_jina', 'Jina Reader')}</option>
              <option value="google">{t('settings.web_search_engine_google', 'Google API')}</option>
              <option value="bing">{t('settings.web_search_engine_bing', 'Bing Search')}</option>
            </select>
          </div>
          
          <div className={styles.row}>
            <label className={styles.label}>{t('agent.tools.param_max_results', '搜索结果上限')}</label>
            <div className={styles.sliderWrapper}>
               <input 
                 type="range" 
                 min="1" max="15" step="1"
                 disabled={!searchConfig.enabled}
                 className={styles.rangeInput}
                 value={searchConfig.searchResultLimit}
                 onChange={(e) => onSearchChange({ ...searchConfig, searchResultLimit: parseInt(e.target.value) })}
               />
               <span className={styles.valBadge}>{searchConfig.searchResultLimit} {t('common.count_items').replace('$count', '')}</span>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.cardSection}>
         <div className={styles.cardHeader}>
           <div className={styles.cardTitleLine}>
             <span>📑 {t('settings.summary_compress_title', '文本内容压缩 (Summarizer)')}</span>
           </div>
           <p className={styles.cardDesc}>{t('settings.summary_compress_desc', '自动归纳超长文本以节省上下文及处理成本。')}</p>
         </div>

         <div className={styles.cardBody}>
           <div className={styles.row}>
             <label className={styles.label}>{t('settings.summary_threshold', '自动压缩字数阈值')}</label>
             <div className={styles.sliderWrapper}>
               <input 
                 type="range" 
                 min="1000" max="64000" step="1000"
                 className={styles.rangeInputColored}
                 value={summaryConfig.autoSummarizeThreshold}
                 onChange={(e) => onSummaryChange({ ...summaryConfig, autoSummarizeThreshold: parseInt(e.target.value) })}
               />
               <span className={styles.valBadge}>{summaryConfig.autoSummarizeThreshold}</span>
             </div>
           </div>

           <div className={styles.row}>
             <label className={styles.label}>{t('settings.summary_method', '归纳方式')}</label>
             <select 
               className={styles.selectBox}
               value={summaryConfig.summarizeMethod}
               onChange={(e) => onSummaryChange({ ...summaryConfig, summarizeMethod: e.target.value as any })}
             >
               <option value="extract">{t('settings.summary_method_extract', '抽取式 (Extract) - 抽取原文本的关键句')}</option>
               <option value="abstract">{t('settings.summary_method_abstract', '生成式 (Abstract) - 经过大模型重写大纲')}</option>
             </select>
           </div>
         </div>
      </div>

    </div>
  );
};
