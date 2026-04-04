import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './RagMemoryView.module.css';

export interface RagConfig {
  topK: number;
  similarityThreshold: number;
  maxTokensLimit: number;
  ragEnabled: boolean; // 新增全域开关
}

export interface RagStats {
  totalCount: number;
  currentDimension: number;
  totalSizeText: string;
}

export interface RagState {
  isRunning: boolean;
  type: 'idle' | 'batchEmbed' | 'migration';
  progress: number;
  total: number;
  statusText: string;
}

export interface RagEntry {
  embeddingId: string;
  text: string;
  modelId: string;
  createdAt: number;
}

interface RagMemoryViewProps {
  config: RagConfig;
  stats: RagStats;
  ragState: RagState;
  hasMismatchModel: boolean;
  entries: RagEntry[];
  
  onChange: (config: RagConfig) => void;
  onClearDimension?: () => Promise<void>;
  onBatchEmbed?: () => Promise<void>;
  onAddManualMemory?: () => Promise<void>;
  onTriggerMigration?: () => Promise<void>;
  onClearAll?: () => Promise<void>;
  onSearch?: (query: string) => void;
  onDeleteEntry?: (id: string) => Promise<void>;
  onEditEntry?: (entry: RagEntry) => Promise<void>;
}

export const RagMemoryView: React.FC<RagMemoryViewProps> = ({ 
  config, stats, ragState, hasMismatchModel, entries,
  onChange, onClearDimension, onBatchEmbed, onAddManualMemory, 
  onTriggerMigration, onClearAll, onSearch, onDeleteEntry, onEditEntry 
}) => {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
  const v = e.target.value;
    setSearchQuery(v);
    if (onSearch) onSearch(v);
  };

  const handleClearSearch = () => {
  setSearchQuery('');
    if (onSearch) onSearch('');
  };

  const formatDate = (ms: number) => {


    const d = new Date(ms);
    return `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  return (
    <div className={styles.container}>
      <div className={styles.headerRow}>
        <div className={styles.titleInfo}>
          <h3 className={styles.title}>{t('settings.rag_title', '语义搜索库 (RAG)')}</h3>
          <p className={styles.subtitle}>{t('settings.rag_subtitle', '管理本地知识的向量化进度与搜索参数。')}</p>
        </div>
        <div className={styles.globalSwitchRow}>
           <span className={config.ragEnabled ? styles.tagSafe : styles.tagDanger}>
             {config.ragEnabled ? t('status_on', 'ON') : t('status_off', 'OFF')}
           </span>
           <label className={styles.switch}>
             <input 
               type="checkbox" 
               checked={config.ragEnabled}
               onChange={(e) => onChange({ ...config, ragEnabled: e.target.checked })}
             />
             <span className={styles.slider}></span>
           </label>
        </div>
      </div>

      {!config.ragEnabled && (
         <div className={styles.disabledAlert}>
           ⚠️ {t('settings.rag_disabled_alert', '语义搜索已被禁用。AI 在对话时将无法隐式搜索并参考您的本地知识库内容。')}
         </div>
      )}

      {/* 统计横幅 */}
      <div className={styles.statsBoard}>
        <div className={styles.statBox}>
          <span className={styles.statLabel}>{t('settings.rag_total_count', '向量块总数')}</span>
          <span className={styles.statValue}>{stats.totalCount} <small>{t('common.count_items').replace('$count', '')}</small></span>
        </div>
        <div className={styles.statBox}>
          <span className={styles.statLabel}>{t('settings.rag_dimension', '向量维度')}</span>
          <span className={styles.statValue}>{stats.currentDimension > 0 ? stats.currentDimension : '---'}</span>
        </div>
        <div className={styles.statBox}>
          <span className={styles.statLabel}>{t('settings.rag_cache_size', '缓存空间')}</span>
          <span className={styles.statValue}>{stats.totalSizeText}</span>
        </div>
      </div>

      {/* 参数区 */}
      <div className={styles.grid}>
        <div className={styles.paramCard}>
          <div className={styles.paramHeader}>
             <span className={styles.paramTitle}>{t('settings.rag_top_k', '召回数量上限 (Top-K)')}</span>
             <span className={styles.paramValue}>{config.topK}</span>
          </div>
          <input 
             type="range" className={styles.rangeInput}
             min="1" max="50" step="1" value={config.topK}
             onChange={(e) => onChange({ ...config, topK: parseInt(e.target.value) })}
          />
        </div>
        <div className={styles.paramCard}>
          <div className={styles.paramHeader}>
             <span className={styles.paramTitle}>{t('settings.rag_similarity_threshold', '相似度阈值')}</span>
             <span className={styles.paramValue}>{config.similarityThreshold.toFixed(2)}</span>
          </div>
          <input 
             type="range" className={styles.rangeInput}
             min="0" max="1" step="0.05" value={config.similarityThreshold}
             onChange={(e) => onChange({ ...config, similarityThreshold: parseFloat(e.target.value) })}
          />
        </div>
        <div className={styles.paramCard}>
          <div className={styles.paramHeader}>
             <span className={styles.paramTitle}>{t('settings.rag_max_tokens_limit', '召回截断上限 (Tokens)')}</span>
             <span className={styles.paramValue}>{config.maxTokensLimit}</span>
          </div>
          <input 
             type="range" className={styles.rangeInput}
             min="500" max="100000" step="500" value={config.maxTokensLimit}
             onChange={(e) => onChange({ ...config, maxTokensLimit: parseInt(e.target.value) })}
          />
        </div>
      </div>

      {/* 迁移与进度 */}
      {ragState.isRunning && ragState.type === 'migration' && (
        <div className={styles.migrationAlert}>
          <div className={styles.migrationRow}>
            <div className={styles.spinner}></div>
            <span className={styles.migTitle}>{t('settings.rag_migrating', '知识库正在迁移中...')}</span>
          </div>
          <p className={styles.migDesc}>{ragState.statusText || t('settings.rag_migrating_desc', '正在根据新模型重新生成知识库向量...')}</p>
          <div className={styles.progressBar}>
             <div className={styles.progressFill} style={{ width: `${Math.min(100, Math.max(0, (ragState.progress / ragState.total) * 100))}%` }}></div>
          </div>
        </div>
      )}

      {!ragState.isRunning && hasMismatchModel && (
        <div className={styles.dangerAlert}>
          <div className={styles.dangerRow}>
            <span className={styles.dangerTitle}>⚠️ {t('settings.rag_model_mismatch', '模型版本不匹配')}</span>
          </div>
          <p className={styles.dangerDesc}>{t('settings.rag_model_mismatch_desc', '系统检测到当前的向量库由不同的嵌入模型(Embedding)生成。必须执行数据迁移，否则搜索功能将无法正确工作或引发错误。')}</p>
          <button className={styles.dangerBtn} onClick={onTriggerMigration}>{t('settings.rag_trigger_migration', '执行向量库迁移')}</button>
        </div>
      )}

      {/* 控制按钮 */}
      <div className={styles.controlChipsRow}>
        <button className={styles.chipDanger} onClick={onClearDimension} disabled={ragState.isRunning}>
           🗑 {t('settings.rag_clear_dimension', '清理当前维度数据')}
        </button>
        <button className={styles.chipPrimary} onClick={onBatchEmbed} disabled={ragState.isRunning}>
           {ragState.isRunning && ragState.type === 'batchEmbed' ? `⏳ ${t('common.processing', '处理中')} ${ragState.progress}/${ragState.total}` : `📖 ${t('settings.rag_batch_embed', '全量扫描未索引日记')}`}
        </button>
        <button className={styles.chipTertiary} onClick={onAddManualMemory} disabled={ragState.isRunning}>
           ✍️ {t('settings.rag_add_manual', '添加手动记忆片段')}
        </button>
        {stats.totalCount > 0 && (
           <button className={styles.chipNuke} onClick={onClearAll} disabled={ragState.isRunning}>
             ☢️ {t('settings.rag_clear_all', '清空所有向量数据')}
           </button>
        )}
      </div>

      {/* 搜索与卡片区块 */}
      <div className={styles.listSection}>
         <div className={styles.searchBox}>
           <div className={styles.searchIcon}>🔍</div>
           <input 
             type="text" 
             placeholder={t('common.search_hint', '搜索记忆...')} 
             className={styles.searchInput}
             value={searchQuery}
             onChange={handleSearch}
           />
           {searchQuery && (
              <div className={styles.clearSearch} onClick={handleClearSearch}>×</div>
           )}
         </div>

         <div className={styles.entriesList}>
           {entries.length === 0 ? (
             <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>🕳️</div>
                <div className={styles.emptyTitle}>{searchQuery ? t('common.no_search_result', '没有找到相关结果') : t('common.no_content', '暂无内容')}</div>
                <div className={styles.emptyDesc}>{t('settings.rag_empty_desc', '当 AI 阅读日记或生成内容时，底层向量数据将在这里自动生成并被管理。')}</div>
             </div>
           ) : (
             entries.map(e => (
               <div key={e.embeddingId} className={styles.entryCard}>
                  <div className={styles.entryRow}>
                    <div className={styles.entryText}>{e.text}</div>
                    <div className={styles.entryActions}>
                       <button className={styles.actionBtnEdit} onClick={() => onEditEntry && onEditEntry(e)}>✏️</button>
                       <button className={styles.actionBtnDel} onClick={() => onDeleteEntry && onDeleteEntry(e.embeddingId)}>🗑</button>
                    </div>
                  </div>
                  <div className={styles.entryFooter}>
                     <span className={styles.entryMetaModel}>🧬 {e.modelId}</span>
                     <span className={styles.entryMetaTime}>📅 {formatDate(e.createdAt)}</span>
                  </div>
               </div>
             ))
           )}
         </div>
      </div>
    </div>
  );
};
