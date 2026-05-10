import React, { useState } from 'react';
import styles from './WebSearchSettingsView.module.css';
import { useTranslation } from 'react-i18next';
import { useToast } from '../Toast/useToast';
import { MdFormatListNumbered, MdAutoAwesome, MdCompress, MdLibraryBooks, MdShortText, MdVisibility, MdVisibilityOff, MdSave, MdKey } from 'react-icons/md';
import { Switch } from '../Switch/Switch';

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
      {/* Engine Selection */}
      <div className={styles.cardSection}>
        <div className={styles.cardHeader}>
           <h3 className={styles.cardTitle}>{t('agent.tools.param_search_engine', '搜索引擎')}</h3>
        </div>
        <div className={styles.cardBody}>
           <label className={`${styles.radioListTile} ${searchConfig.webSearchEngine === 'local-bing' ? styles.radioSelected : ''}`}>
             <input 
               type="radio" 
               name="engine" 
               value="local-bing" 
               className={styles.radioInput}
               checked={searchConfig.webSearchEngine === 'local-bing'}
               onChange={(e) => handleChange('webSearchEngine', e.target.value)}
             />
             <div className={styles.radioCustomContainer}>
                <div className={styles.radioCustomRing}>
                   {searchConfig.webSearchEngine === 'local-bing' && <div className={styles.radioCustomDot} />}
                </div>
             </div>
             <div className={styles.radioContent}>
               <span className={styles.radioTitle}>{t('settings.web_search_engine_local_bing', 'Bing 本地搜索')}</span>
               <span className={styles.radioSubtitle}>{t('settings.web_search_engine_local_bing_desc', '使用本地浏览器搜索 Bing，无需 API 密钥')}</span>
             </div>
           </label>

           <label className={`${styles.radioListTile} ${searchConfig.webSearchEngine === 'local-google' ? styles.radioSelected : ''}`}>
             <input 
               type="radio" 
               name="engine" 
               value="local-google" 
               className={styles.radioInput}
               checked={searchConfig.webSearchEngine === 'local-google'}
               onChange={(e) => handleChange('webSearchEngine', e.target.value)}
             />
             <div className={styles.radioCustomContainer}>
                <div className={styles.radioCustomRing}>
                   {searchConfig.webSearchEngine === 'local-google' && <div className={styles.radioCustomDot} />}
                </div>
             </div>
             <div className={styles.radioContent}>
               <span className={styles.radioTitle}>{t('settings.web_search_engine_local_google', 'Google 本地搜索')}</span>
               <span className={styles.radioSubtitle}>{t('settings.web_search_engine_local_google_desc', '使用本地浏览器搜索 Google，无需 API 密钥')}</span>
             </div>
           </label>

           <label className={`${styles.radioListTile} ${searchConfig.webSearchEngine === 'duckduckgo' ? styles.radioSelected : ''}`}>
             <input 
               type="radio" 
               name="engine" 
               value="duckduckgo" 
               className={styles.radioInput}
               checked={searchConfig.webSearchEngine === 'duckduckgo'}
               onChange={(e) => handleChange('webSearchEngine', e.target.value)}
             />
             <div className={styles.radioCustomContainer}>
                <div className={styles.radioCustomRing}>
                   {searchConfig.webSearchEngine === 'duckduckgo' && <div className={styles.radioCustomDot} />}
                </div>
             </div>
             <div className={styles.radioContent}>
               <span className={styles.radioTitle}>{t('settings.web_search_engine_duckduckgo', 'DuckDuckGo')}</span>
               <span className={styles.radioSubtitle}>{t('settings.web_search_engine_duckduckgo_desc', '免费通用型查询')}</span>
             </div>
           </label>
           
            <label className={`${styles.radioListTile} ${searchConfig.webSearchEngine === 'tavily' ? styles.radioSelected : ''}`}>
              <input 
                type="radio" 
                name="engine" 
                value="tavily" 
                className={styles.radioInput}
                checked={searchConfig.webSearchEngine === 'tavily'}
                onChange={(e) => handleChange('webSearchEngine', e.target.value)}
              />
              <div className={styles.radioCustomContainer}>
                 <div className={styles.radioCustomRing}>
                    {searchConfig.webSearchEngine === 'tavily' && <div className={styles.radioCustomDot} />}
                 </div>
              </div>
              <div className={styles.radioContent}>
                <span className={styles.radioTitle}>{t('settings.web_search_engine_tavily', 'Tavily API')}</span>
                <span className={styles.radioSubtitle}>{t('settings.web_search_engine_tavily_desc', '高速智能搜索引擎（需配置密钥）')}</span>
              </div>
            </label>
                 </div>
              </div>

      {/* API Config Panel */}
      {searchConfig.webSearchEngine === 'tavily' && (
        <div className={styles.cardSection}>
          <div className={styles.apiConfigBody}>
             <h3 className={styles.cardTitle}>{t('agent.tools.param_tavily_api_key', 'Tavily API Key')}</h3>
             <span className={styles.cardDesc}>{t('agent.tools.param_tavily_api_key_desc', '请前往 tvly 官网申请您的私人密钥')}</span>
             
             <div className={styles.textFieldWrapper}>
               <MdKey size={20} className={styles.textFieldIcon} />
               <input 
                 type={apiKeyVisible ? 'text' : 'password'}
                 placeholder="tvly-xxxxxx"
                 className={styles.textFieldInput}
                 value={localApiKey}
                 onChange={(e) => setLocalApiKey(e.target.value)}
                 onKeyDown={(e) => e.key === 'Enter' && saveApiKey()}
               />
               <button className={styles.iconIconButton} onClick={() => setApiKeyVisible(!apiKeyVisible)}>
                 {apiKeyVisible ? <MdVisibility size={20} /> : <MdVisibilityOff size={20} />}
               </button>
               <button className={styles.iconIconButton} onClick={saveApiKey}>
                 <MdSave size={20} />
               </button>
             </div>
          </div>
        </div>
      )}

      {/* General Settings Card */}
      <div className={styles.cardSection}>
        <div className={styles.cardHeader}>
           <h3 className={styles.cardTitle}>{t('settings.general', '通用规则设置')}</h3>
        </div>
        <div className={styles.cardBody}>
           <div className={styles.sliderRow}>
             <div className={styles.sliderRowHeader}>
               <MdFormatListNumbered className={styles.sliderIcon} />
               <div className={styles.sliderTextGroup}>
                 <span className={styles.sliderTitle}>{t('agent.tools.param_max_results', '搜索结果上限')}</span>
                 <span className={styles.sliderDesc}>{t('agent.tools.param_max_results_desc', '最多返回的条目数')}</span>
               </div>
             </div>
             <div className={styles.sliderControlRow}>
               <input type="range" min="1" max="30" value={searchConfig.webSearchMaxResults} onChange={(e) => handleChange('webSearchMaxResults', parseInt(e.target.value))} className={styles.sliderInput} />
               <span className={styles.sliderValue}>{searchConfig.webSearchMaxResults}</span>
             </div>
           </div>
           
           <div className={styles.divider} />
           
           <div className={styles.switchTile}>
             <MdAutoAwesome className={styles.switchIcon} />
             <div className={styles.switchTextGroup}>
               <span className={styles.sliderTitle}>{t('agent.tools.param_rag_enabled', '网页智能抽取 (Web-RAG)')}</span>
               <span className={styles.sliderDesc}>{t('agent.tools.param_rag_enabled_desc', '开启深入阅读理解')}</span>
             </div>
             <Switch 
               checked={searchConfig.webSearchRagEnabled}
               onChange={(e) => handleChange('webSearchRagEnabled', e.target.checked)}
             />
           </div>
           
           {searchConfig.webSearchRagEnabled ? (
             <>
               <div className={styles.divider} />
               <div className={styles.sliderRow}>
                 <div className={styles.sliderRowHeader}>
                   <MdCompress className={styles.sliderIcon} />
                   <div className={styles.sliderTextGroup}>
                     <span className={styles.sliderTitle}>{t('agent.tools.param_rag_max_chunks', '总片段上限')}</span>
                     <span className={styles.sliderDesc}>{t('agent.tools.param_rag_max_chunks_desc', '最多提取的片段数')}</span>
                   </div>
                 </div>
                 <div className={styles.sliderControlRow}>
                   <input type="range" min="1" max="50" value={searchConfig.webSearchRagMaxChunks} onChange={(e) => handleChange('webSearchRagMaxChunks', parseInt(e.target.value))} className={styles.sliderInput} />
                   <span className={styles.sliderValue}>{searchConfig.webSearchRagMaxChunks}</span>
                 </div>
               </div>

               <div className={styles.divider} />
               
               <div className={styles.sliderRow}>
                 <div className={styles.sliderRowHeader}>
                   <MdLibraryBooks className={styles.sliderIcon} />
                   <div className={styles.sliderTextGroup}>
                     <span className={styles.sliderTitle}>{t('agent.tools.param_rag_chunks_per_source', '单站抽取块数')}</span>
                     <span className={styles.sliderDesc}>{t('agent.tools.param_rag_chunks_per_source_desc', '单个网页提取最大数')}</span>
                   </div>
                 </div>
                 <div className={styles.sliderControlRow}>
                   <input type="range" min="1" max="20" value={searchConfig.webSearchRagChunksPerSource} onChange={(e) => handleChange('webSearchRagChunksPerSource', parseInt(e.target.value))} className={styles.sliderInput} />
                   <span className={styles.sliderValue}>{searchConfig.webSearchRagChunksPerSource}</span>
                 </div>
               </div>
             </>
           ) : (
             <>
               <div className={styles.divider} />
               <div className={styles.sliderRow}>
                 <div className={styles.sliderRowHeader}>
                   <MdShortText className={styles.sliderIcon} />
                   <div className={styles.sliderTextGroup}>
                     <span className={styles.sliderTitle}>{t('agent.tools.param_plain_snippet_length', '简单摘要截取长度')}</span>
                     <span className={styles.sliderDesc}>{t('agent.tools.param_plain_snippet_length_desc', '当不启用 RAG 时提取正文的字符数')}</span>
                   </div>
                 </div>
                 <div className={styles.sliderControlRow}>
                   <input type="range" min="500" max="30000" step="100" value={searchConfig.webSearchPlainSnippetLength} onChange={(e) => handleChange('webSearchPlainSnippetLength', parseInt(e.target.value))} className={styles.sliderInput} />
                   <span className={styles.sliderValue}>{searchConfig.webSearchPlainSnippetLength}</span>
                 </div>
               </div>
             </>
           )}
           
        </div>
      </div>
    </div>
  );
};
