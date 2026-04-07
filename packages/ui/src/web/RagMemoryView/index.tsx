import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  MdColorLens, MdDeleteSweep, MdMemory, MdStorage, MdCheckCircleOutline, 
  MdRefresh, MdTune, MdLayersClear, MdAutoStories, MdAddComment, 
  MdSync, MdSearch, MdClose, MdMoreVert, MdWarning
} from 'react-icons/md';
import styles from './RagMemoryView.module.css';

export interface RagConfig {
  ragTopK: number;
  ragSimilarityThreshold: number;
  ragEnabled: boolean;
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
  embeddingModelId?: string;
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
  config, stats, ragState, hasMismatchModel, embeddingModelId, entries,
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
    return `${String(d.getMonth()+1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const isBusy = ragState.isRunning;
  const isMigrating = ragState.isRunning && ragState.type === 'migration';
  const isBatchEmbedding = ragState.isRunning && ragState.type === 'batchEmbed';

  return (
    <div className={styles.container}>
      {/* 1. Header & Switch */}
      <div className={styles.headerRow}>
        <div className={styles.titleInfo}>
          <div className={styles.titleIcon}><MdColorLens size={24} /></div>
          <h2 className={styles.title}>{t('agent.rag.title', 'RAG 记忆管理')}</h2>
          <label className={styles.switch}>
             <input 
               type="checkbox" 
               checked={config.ragEnabled}
               onChange={(e) => onChange({ ...config, ragEnabled: e.target.checked })}
             />
             <span className={styles.slider}></span>
          </label>
        </div>
        
        {stats.totalCount > 0 && (
          <button className={styles.headerClearAllBtn} onClick={onClearAll}>
            <MdDeleteSweep size={18} />
            <span>{t('settings.rag_clear_all', '清空')}</span>
          </button>
        )}
      </div>

      {!config.ragEnabled && (
         <div className={styles.disabledAlert}>
           <MdWarning size={16} style={{marginRight: 8}} />
           {t('settings.rag_disabled_alert', '语义搜索已被禁用。AI 在对话时将无法隐式搜索并参考您的本地知识库内容。')}
         </div>
      )}

      {/* 2. Stats Chips Row */}
      <div className={styles.statsChipsRow}>
        <div className={`${styles.statChip} ${styles.chipBlue}`}>
          <span className={styles.chipIcon}><MdStorage size={14} /></span>
          <span className={styles.chipLabel}>总条目:</span>
          <span className={styles.chipStrong}>{stats.totalCount}</span>
        </div>
        <div className={`${styles.statChip} ${styles.chipGreen}`}>
          <span className={styles.chipIcon}><MdMemory size={14} /></span>
          <span className={styles.chipLabel}>模型:</span>
          <span className={styles.chipStrong}>{embeddingModelId || 'Unassigned'}</span>
        </div>
        <div className={`${styles.statChip} ${styles.chipGrey}`}>
          <span className={styles.chipIcon}><MdStorage size={14} /></span>
          <span className={styles.chipLabel}>维度:</span>
          <span className={styles.chipStrong}>{stats.currentDimension > 0 ? stats.currentDimension : '---'}</span>
        </div>
        <div className={`${styles.statChip} ${styles.chipGreenLight}`}>
          <span className={styles.chipIcon}><MdCheckCircleOutline size={14} /></span>
          <span className={styles.chipLabel}>自动检测:</span>
          <span className={styles.chipStrong}>{stats.currentDimension > 0 ? `${stats.currentDimension}维` : '---'}</span>
          <span className={styles.chipActionIcon}><MdRefresh size={14} /></span>
        </div>
      </div>

      {/* 3. Retrieval Config Block */}
      <div className={styles.configBlock}>
         <div className={styles.configBlockHeader}>
            <span className={styles.configBlockIcon}><MdTune size={18} /></span>
            <span className={styles.configBlockTitle}>{t('settings.rag_config_params', '检索参数调节')}</span>
         </div>
         <div className={styles.paramSliders}>
            <div className={styles.paramSliderRow}>
              <span className={styles.paramLabel}>Top K</span>
              <input 
                type="range" className={styles.rangeInput}
                min="1" max="50" step="1" value={config.ragTopK || 30}
                onChange={(e) => onChange({ ...config, ragTopK: parseInt(e.target.value) })}
              />
              <span className={styles.paramValueBlue}>{config.ragTopK || 30}</span>
            </div>
            <div className={styles.paramSliderRow}>
              <span className={styles.paramLabel}>相似度阈值</span>
              <input 
                type="range" className={styles.rangeInput}
                min="0" max="1" step="0.05" value={config.ragSimilarityThreshold ?? 0.4}
                onChange={(e) => onChange({ ...config, ragSimilarityThreshold: parseFloat(e.target.value) })}
              />
              <span className={styles.paramValueBlue}>{(config.ragSimilarityThreshold ?? 0.4).toFixed(2)}</span>
            </div>
         </div>
      </div>

      {/* Migrations & Progress */}
      {isMigrating && (
        <div className={styles.migrationAlert}>
          <div className={styles.migrationRow}>
            <div className={styles.spinner}></div>
            <span className={styles.migTitle}>{t('settings.rag_migrating', '知识库正在迁移中...')}</span>
          </div>
          <p className={styles.migDesc}>{ragState.statusText}</p>
          <div className={styles.progressBar}>
             <div className={styles.progressFill} style={{ width: `${Math.min(100, Math.max(0, (ragState.progress / ragState.total) * 100))}%` }}></div>
          </div>
        </div>
      )}

      {!ragState.isRunning && hasMismatchModel && (
        <div className={styles.dangerAlert}>
          <div className={styles.dangerRow}>
            <MdWarning size={18} color="#ef4444" />
            <span className={styles.dangerTitle}>{t('settings.rag_model_mismatch', '模型版本不匹配')}</span>
          </div>
          <p className={styles.dangerDesc}>{t('settings.rag_model_mismatch_desc', '系统检测到当前的向量库由不同的嵌入模型(Embedding)生成。必须执行数据迁移，否则搜索功能将无法正确工作或引发错误。')}</p>
          <button className={styles.dangerBtn} onClick={onTriggerMigration}>
            <MdSync size={16} style={{marginRight: 4}} />
            {t('settings.rag_trigger_migration', '手动迁移模型配置')}
          </button>
        </div>
      )}

      {/* 4. Action Buttons */}
      <div className={styles.actionButtonsRow}>
        <button className={`${styles.actionBtn} ${styles.btnRedOutlined}`} onClick={onClearDimension} disabled={isBusy}>
           <MdLayersClear size={16} /> {t('settings.rag_clear_dimension', '清空当前维度')}
        </button>
        <button className={`${styles.actionBtn} ${styles.btnBlueFlat}`} onClick={onBatchEmbed} disabled={isBusy}>
           <MdAutoStories size={16} /> {isBatchEmbedding ? `${t('common.processing', '处理中')} ${ragState.progress}/${ragState.total}` : t('settings.rag_batch_embed', '全量嵌入日记')}
        </button>
        <button className={`${styles.actionBtn} ${styles.btnGreenOutlined}`} onClick={onAddManualMemory} disabled={isBusy}>
           <MdAddComment size={16} /> {t('settings.rag_add_manual', '手动添加记忆')}
        </button>
        <button className={`${styles.actionBtn} ${styles.btnGreyOutlined}`} onClick={onTriggerMigration} disabled={isBusy}>
           <MdSync size={16} /> 手动迁移模型配置
        </button>
      </div>

      {/* 5. Search Bar */}
      <div className={styles.searchBoxOuter}>
        <div className={styles.searchIconOuter}><MdSearch size={20} /></div>
        <input 
          type="text" 
          placeholder={t('common.search_hint', '搜索记忆内容...')} 
          className={styles.searchOuterInput}
          value={searchQuery}
          onChange={handleSearch}
        />
        {searchQuery && (
          <div className={styles.clearSearchOuter} onClick={handleClearSearch}><MdClose size={18} /></div>
        )}
      </div>

      {/* 6. List */}
      <div className={styles.entriesListContainer}>
        {entries.length === 0 ? (
          <div className={styles.emptyStateContainer}>
            <div className={styles.emptyIconBig}><MdMemory size={64} /></div>
            <div className={styles.emptyTitleLarge}>{searchQuery ? t('common.no_search_result', '没有找到相关结果') : t('common.no_content', '暂无内容')}</div>
            <div className={styles.emptyDescSub}>{t('settings.rag_empty_desc', '当 AI 阅读日记或生成内容时，底层向量数据将在这里自动生成并被管理。')}</div>
          </div>
        ) : (
          <div className={styles.entriesWaterfall}>
            {entries.map(e => (
              <div key={e.embeddingId} className={styles.memoryEntryCard}>
                 <div className={styles.memoryEntryIconBlock}>
                    <span className={styles.memoryEntryBraces}>{`{}`}</span>
                 </div>
                 <div className={styles.memoryEntryContentBlock}>
                    <div className={styles.memoryEntryText}>{e.text}</div>
                    {/* Assuming tags aren't perfectly parsed yet, but if they are inside text we can leave it. */}
                    <div className={styles.memoryEntryFooter}>
                       <span>{e.modelId}</span>
                       <span>·</span>
                       <span>{formatDate(e.createdAt)}</span>
                    </div>
                 </div>
                 <div className={styles.memoryEntryActionsBlock}>
                    <button className={styles.memoryMoreBtn} onClick={() => onEditEntry && onEditEntry(e)}><MdMoreVert size={20} /></button>
                 </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
