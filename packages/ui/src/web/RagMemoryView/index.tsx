import React, { useState } from 'react';
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
          <h3 className={styles.title}>神经网格集簇 (RAG Brain)</h3>
          <p className={styles.subtitle}>管控您的私域知识向量化进程与下潜探索阈限。</p>
        </div>
        <div className={styles.globalSwitchRow}>
           <span className={config.ragEnabled ? styles.tagSafe : styles.tagDanger}>
             {config.ragEnabled ? '网格映射激活' : '感知系统已休眠'}
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
           ⚠️ 当前 RAG 内省系统已被禁用。白守在对话时将不会加载下方的知识片段，所有对过去的搜索将被物理切断。
         </div>
      )}

      {/* 统计横幅 */}
      <div className={styles.statsBoard}>
        <div className={styles.statBox}>
          <span className={styles.statLabel}>脑突触总数</span>
          <span className={styles.statValue}>{stats.totalCount} <small>Cells</small></span>
        </div>
        <div className={styles.statBox}>
          <span className={styles.statLabel}>阵列算子维度</span>
          <span className={styles.statValue}>{stats.currentDimension > 0 ? stats.currentDimension : '---'} <small>Dims</small></span>
        </div>
        <div className={styles.statBox}>
          <span className={styles.statLabel}>物理缓存</span>
          <span className={styles.statValue}>{stats.totalSizeText}</span>
        </div>
      </div>

      {/* 神经网格调优参数区 */}
      <div className={styles.grid}>
        <div className={styles.paramCard}>
          <div className={styles.paramHeader}>
             <span className={styles.paramTitle}>Top-K 切片召回量</span>
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
             <span className={styles.paramTitle}>余弦严谨限阀</span>
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
             <span className={styles.paramTitle}>单次组流熔断</span>
             <span className={styles.paramValue}>{config.maxTokensLimit}</span>
          </div>
          <input 
             type="range" className={styles.rangeInput}
             min="500" max="100000" step="500" value={config.maxTokensLimit}
             onChange={(e) => onChange({ ...config, maxTokensLimit: parseInt(e.target.value) })}
          />
        </div>
      </div>

      {/* 迁移与进度高光警示 */}
      {ragState.isRunning && ragState.type === 'migration' && (
        <div className={styles.migrationAlert}>
          <div className={styles.migrationRow}>
            <div className={styles.spinner}></div>
            <span className={styles.migTitle}>异构基因迁移重组中...</span>
          </div>
          <p className={styles.migDesc}>{ragState.statusText || '正在刷新重洗庞大的旧知识片段到新模型维度...'}</p>
          <div className={styles.progressBar}>
             <div className={styles.progressFill} style={{ width: `${Math.min(100, Math.max(0, (ragState.progress / ragState.total) * 100))}%` }}></div>
          </div>
        </div>
      )}

      {!ragState.isRunning && hasMismatchModel && (
        <div className={styles.dangerAlert}>
          <div className={styles.dangerRow}>
            <span className={styles.dangerTitle}>⚠️ 特征算子基因排斥警告！</span>
          </div>
          <p className={styles.dangerDesc}>系统检测到您当前的记忆神经元中有由不同版本的 Embedding 模型所编码的切片。如果不发起强制大迁徙，这些数据在矩阵乘算时将使主控宕机。</p>
          <button className={styles.dangerBtn} onClick={onTriggerMigration}>执行洗牌与强制大迁徙</button>
        </div>
      )}

      {/* RAG 控制端（四大硬切按钮） */}
      <div className={styles.controlChipsRow}>
        <button className={styles.chipDanger} onClick={onClearDimension} disabled={ragState.isRunning}>
           🗑 洗空当前维度映射
        </button>
        <button className={styles.chipPrimary} onClick={onBatchEmbed} disabled={ragState.isRunning}>
           {ragState.isRunning && ragState.type === 'batchEmbed' ? `⏳ 加挂中 ${ragState.progress}/${ragState.total}` : '📖 强扫未绑定日记'}
        </button>
        <button className={styles.chipTertiary} onClick={onAddManualMemory} disabled={ragState.isRunning}>
           ✍️ 手动凝结思想块
        </button>
        {stats.totalCount > 0 && (
           <button className={styles.chipNuke} onClick={onClearAll} disabled={ragState.isRunning}>
             ☢️ 炸毁全部记忆层
           </button>
        )}
      </div>

      {/* 搜索与卡片区块 */}
      <div className={styles.listSection}>
         <div className={styles.searchBox}>
           <div className={styles.searchIcon}>🔍</div>
           <input 
             type="text" 
             placeholder="搜索特定词元或引用的模型 ID..." 
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
                <div className={styles.emptyTitle}>{searchQuery ? '查无此相关记忆分形' : '此处正处于原始虚空状态'}</div>
                <div className={styles.emptyDesc}>当白守阅读日记、生成笔记时，此区域会自动结晶出能够闪聚思想池的向量数据。</div>
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
