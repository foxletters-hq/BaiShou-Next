import React, { useState } from 'react';
import styles from './WebSearchSettingsView.module.css';
import { useTranslation } from 'react-i18next';
import { useToast } from '../Toast/useToast';

export interface WebSearchConfig {
  webSearchEngine: string;
  webSearchMaxResults: number;
  webSearchRagEnabled: boolean;
  tavilyApiKey: string;
  webSearchRagMaxChunks: number;
  webSearchRagChunksPerSource: number;
  webSearchPlainSnippetLength: number;
}

interface WebSearchSettingsViewProps {
  searchConfig: WebSearchConfig;
  onSearchChange: (config: WebSearchConfig) => void;
}

export const WebSearchSettingsView: React.FC<WebSearchSettingsViewProps> = ({
  searchConfig,
  onSearchChange
}) => {
  const { t } = useTranslation();
  const toast = useToast();
  const [apiKeyVisible, setApiKeyVisible] = useState(false);
  const [localApiKey, setLocalApiKey] = useState(searchConfig.tavilyApiKey || '');

  const handleChange = (key: keyof WebSearchConfig, value: any) => {
    onSearchChange({ ...searchConfig, [key]: value });
  };

  const saveApiKey = () => {
    handleChange('tavilyApiKey', localApiKey);
    toast.showSuccess(t('common.success', '操作成功'));
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.titleInfo}>
          <h3 className={styles.title}>{t('settings.web_search_config_title', '网络搜索配置')}</h3>
          <p className={styles.subtitle}>{t('settings.web_search_config_desc', '管理网络检索引擎及文档拉取策略。')}</p>
        </div>
      </div>

      <div className={styles.cardSection}>
        <div className={styles.cardHeader}>
          <div className={styles.cardTitleLine}>
            <span>🌐 {t('agent.tools.param_search_engine', '搜索引擎')}</span>
          </div>
        </div>
        <div className={styles.cardBody}>
          <div className={styles.radioGroup}>
             <label className={styles.radioLabel}>
               <input 
                 type="radio" 
                 name="engine" 
                 value="duckduckgo" 
                 checked={searchConfig.webSearchEngine === 'duckduckgo'}
                 onChange={(e) => handleChange('webSearchEngine', e.target.value)}
               />
               <div className={styles.radioText}>
                 <span>{t('settings.web_search_engine_duckduckgo', 'DuckDuckGo')}</span>
                 <small>{t('settings.web_search_engine_duckduckgo_desc', '免费通用型查询（推荐）')}</small>
               </div>
             </label>

             <label className={styles.radioLabel}>
               <input 
                 type="radio" 
                 name="engine" 
                 value="tavily" 
                 checked={searchConfig.webSearchEngine === 'tavily'}
                 onChange={(e) => handleChange('webSearchEngine', e.target.value)}
               />
               <div className={styles.radioText}>
                 <span>{t('settings.web_search_engine_tavily', 'Tavily API')}</span>
                 <small>{t('settings.web_search_engine_tavily_desc', '高速智能搜索引擎（需配置密钥）')}</small>
               </div>
             </label>
          </div>
        </div>
      </div>

      {searchConfig.webSearchEngine === 'tavily' && (
        <div className={styles.cardSection}>
          <div className={styles.cardHeader}>
            <div className={styles.cardTitleLine}>
              <span>🔑 {t('agent.tools.param_tavily_api_key', 'Tavily API 密钥')}</span>
            </div>
            <p className={styles.cardDesc}>{t('agent.tools.param_tavily_api_key_desc', '请前往 tvly 官网申请您的私人密钥')}</p>
          </div>
          <div className={styles.cardBody}>
             <div className={styles.row}>
               <div className={styles.sliderWrapper}>
                 <input 
                   type={apiKeyVisible ? 'text' : 'password'}
                   placeholder="tvly-xxxxxx"
                   className={`${styles.rangeInputColored} ${styles.textInput}`}
                   style={{ width: '100%', flex: 1 }}
                   value={localApiKey}
                   onChange={(e) => setLocalApiKey(e.target.value)}
                   onKeyDown={(e) => e.key === 'Enter' && saveApiKey()}
                 />
                 <button onClick={() => setApiKeyVisible(!apiKeyVisible)} style={{ margin: '0 8px' }}>
                   {apiKeyVisible ? '👁️‍🗨️' : '👁️'}
                 </button>
                 <button onClick={saveApiKey}>
                   💾
                 </button>
               </div>
             </div>
          </div>
        </div>
      )}

      <div className={styles.cardSection}>
        <div className={styles.cardHeader}>
          <div className={styles.cardTitleLine}>
            <span>⚙️ {t('settings.general', '通用拉取设定')}</span>
          </div>
        </div>
        <div className={styles.cardBody}>
          <div className={styles.row}>
             <div className={styles.labelGroup}>
               <label className={styles.label}>{t('agent.tools.param_max_results', '搜索结果上限')}</label>
               <span className={styles.cardDesc}>{t('agent.tools.param_max_results_desc', '返回的最大条目')}</span>
             </div>
             <div className={styles.sliderWrapper}>
                <input type="range" min="1" max="30" value={searchConfig.webSearchMaxResults} onChange={(e) => handleChange('webSearchMaxResults', parseInt(e.target.value))} className={styles.rangeInput} />
                <span className={styles.valBadge}>{searchConfig.webSearchMaxResults}</span>
             </div>
          </div>

          <div className={styles.row} style={{ margin: '16px 0' }}>
             <div className={styles.labelGroup}>
               <label className={styles.label}>{t('agent.tools.param_rag_enabled', '网页智能抽取 (Web-RAG)')}</label>
               <span className={styles.cardDesc}>{t('agent.tools.param_rag_enabled_desc', '开启深入阅读理解')}</span>
             </div>
             <label className={styles.switch}>
               <input 
                 type="checkbox" 
                 checked={searchConfig.webSearchRagEnabled}
                 onChange={(e) => handleChange('webSearchRagEnabled', e.target.checked)}
               />
               <span className={styles.slider}></span>
             </label>
          </div>

          {searchConfig.webSearchRagEnabled ? (
            <>
              <div className={styles.row}>
                 <div className={styles.labelGroup}>
                   <label className={styles.label}>{t('agent.tools.param_rag_max_chunks', '总片段上限')}</label>
                   <span className={styles.cardDesc}>{t('agent.tools.param_rag_max_chunks_desc', '最多提取的片段数')}</span>
                 </div>
                 <div className={styles.sliderWrapper}>
                    <input type="range" min="1" max="50" value={searchConfig.webSearchRagMaxChunks} onChange={(e) => handleChange('webSearchRagMaxChunks', parseInt(e.target.value))} className={styles.rangeInput} />
                    <span className={styles.valBadge}>{searchConfig.webSearchRagMaxChunks}</span>
                 </div>
              </div>
              <div className={styles.row} style={{ marginTop: '16px' }}>
                 <div className={styles.labelGroup}>
                   <label className={styles.label}>{t('agent.tools.param_rag_chunks_per_source', '单站抽取块数')}</label>
                   <span className={styles.cardDesc}>{t('agent.tools.param_rag_chunks_per_source_desc', '单个网页提取最大数')}</span>
                 </div>
                 <div className={styles.sliderWrapper}>
                    <input type="range" min="1" max="20" value={searchConfig.webSearchRagChunksPerSource} onChange={(e) => handleChange('webSearchRagChunksPerSource', parseInt(e.target.value))} className={styles.rangeInput} />
                    <span className={styles.valBadge}>{searchConfig.webSearchRagChunksPerSource}</span>
                 </div>
              </div>
            </>
          ) : (
            <div className={styles.row}>
               <div className={styles.labelGroup}>
                 <label className={styles.label}>{t('agent.tools.param_plain_snippet_length', '简单摘要截取长度')}</label>
                 <span className={styles.cardDesc}>{t('agent.tools.param_plain_snippet_length_desc', '不开抽取的全文上限')}</span>
               </div>
               <div className={styles.sliderWrapper}>
                  <input type="range" min="500" max="30000" step="100" value={searchConfig.webSearchPlainSnippetLength} onChange={(e) => handleChange('webSearchPlainSnippetLength', parseInt(e.target.value))} className={styles.rangeInput} />
                  <span className={styles.valBadge}>{searchConfig.webSearchPlainSnippetLength}</span>
               </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
