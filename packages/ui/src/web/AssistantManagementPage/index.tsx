import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Pin, PinOff, Trash2, Copy, Plus, Activity, Cpu } from 'lucide-react';
import styles from './AssistantManagementPage.module.css';

// ─── 类型定义 ──────────────────────────────────────────────

export interface AssistantInfo {
  id: string;
  name: string;
  emoji: string;
  description?: string;
  systemPrompt: string;
  contextWindow: number;
  providerId?: string;
  modelId?: string;
  compressTokenThreshold: number;
  
  // 新增针对战列排序必须的时间和频率戳
  createdAt?: number;
  lastUsedAt?: number;
  useCount?: number;
}

export type SortMode = 'name' | 'newest' | 'frequent';

export interface AssistantManagementPageProps {
  assistants: AssistantInfo[];
  pinnedIds: Set<string>;
  onEdit: (assistant: AssistantInfo) => void;
  onCreate: () => void;
  onDelete: (assistantId: string) => void;
  onClone?: (assistant: AssistantInfo) => void;
  onTogglePin: (assistantId: string) => void;
}

// ─── 主组件 ──────────────────────────────────────────────────

export const AssistantManagementPage: React.FC<AssistantManagementPageProps> = ({
  assistants,
  pinnedIds,
  onEdit,
  onCreate,
  onClone,
  onDelete,
  onTogglePin,
}) => {
  const { t } = useTranslation();
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('newest');

  const handleConfirmDelete = () => {
  if (deleteTargetId) {
      onDelete(deleteTargetId);
      setDeleteTargetId(null);
    }
  };

  const formatContextWindow = (n: number) => {
  if (n < 0) return '∞';
    return String(n);
  };
  
  // 核心过滤器和排序引擎
  const processedAssistants = useMemo(() => {
  let filtered = assistants;
     
     // 1. 过滤流
     const query = searchQuery.trim().toLowerCase();
     if(query !== '') {
        filtered = filtered.filter(a => 
           a.name.toLowerCase().includes(query) || 
           (a.description && a.description.toLowerCase().includes(query))
        );
     }
     
     // 2. 排序流
     return [...filtered].sort((a, b) => {
  // 首先，无论什么情况：置顶的必须浮于表层
        const aPinned = pinnedIds.has(a.id);
        const bPinned = pinnedIds.has(b.id);
        if (aPinned && !bPinned) return -1;
        if (!aPinned && bPinned) return 1;
        
        // 执行选定的主排序模式
        if (sortMode === 'name') {
           return a.name.localeCompare(b.name);
        } else if (sortMode === 'newest') {
           return ((b.createdAt || 0) - (a.createdAt || 0));
        } else if (sortMode === 'frequent') {
           return ((b.useCount || 0) - (a.useCount || 0));
        }
        return 0;
     });
     
  }, [assistants, searchQuery, sortMode, pinnedIds]);

  return (
    <div className={styles.page}>
      {/* App Bar -- 带战况雷达和微操控制器 */}
      <div className={styles.appBar}>
        <div className={styles.appBarTitle}>
           <Cpu size={24} color="var(--color-primary, #5BA8F5)" />
           {t('agent.assistant.management_title', '伙伴指控大本营')}
        </div>
        
        <div className={styles.appBarControls}>
           <div className={styles.searchBox}>
              <Search size={16} color="var(--text-secondary)"/>
              <input 
                 className={styles.searchInput}
                 placeholder={t('assistant.search_placeholder', '通过名称检索...')}
                 value={searchQuery}
                 onChange={(e) => setSearchQuery(e.target.value)}
              />
           </div>
           
           <select 
              className={styles.sortSelect} 
              value={sortMode} 
              onChange={(e) => setSortMode(e.target.value as SortMode)}
           >
              <option value="newest">{t('assistant.sort_newest', '按创建时间')}</option>
              <option value="frequent">{t('assistant.sort_frequent', '按使用频率')}</option>
              <option value="name">{t('assistant.sort_name', '按名称字母排序')}</option>
           </select>
        </div>
      </div>

      {/* Grid Region */}
      <div className={styles.scrollArea}>
      {assistants.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}><Cpu size={72} strokeWidth={1} /></div>
          <span className={styles.emptyText}>
            {t('agent.assistant.empty_hint', '全列阵空爆：您的矩阵里还没有服役的心智')}
          </span>
          <button className={styles.emptyBtn} onClick={onCreate}>
            {t('agent.assistant.create_first', '执行首建协议')}
          </button>
        </div>
      ) : (
        <div className={styles.grid}>
          
          {/* Create Button (始终保持第一个可用槽位或追加为卡) 为了对标原版我们放一个卡片式按钮在这里或最后 */}
          <div className={styles.addCard} onClick={onCreate}>
            <div className={styles.addIcon}><Plus size={32} /></div>
            <span className={styles.addText}>
              {t('agent.assistant.create_new', '召唤全新镜像节点')}
            </span>
          </div>

          {processedAssistants.map((assistant) => {
  const isPinned = pinnedIds.has(assistant.id);
            return (
              <div
                key={assistant.id}
                className={`${styles.card} ${isPinned ? styles.cardPinned : ''}`}
                onClick={() => onEdit(assistant)}
              >
                {/* Secret Hover Actions */}
                <div className={styles.cardActions}>
                  <button
                    className={styles.cardActionBtn}
                    title={isPinned ? '取消置顶锁定' : '置顶锁定特权'}
                    onClick={(e) => {
  e.stopPropagation(); onTogglePin(assistant.id); }}
                  >
                    {isPinned ? <PinOff size={15}/> : <Pin size={15}/>}
                  </button>
                  {onClone && (
                     <button
                        className={styles.cardActionBtn}
                        title="裂变克隆本位体"
                        onClick={(e) => {
  e.stopPropagation(); onClone(assistant); }}
                     >
                        <Copy size={15}/>
                     </button>
                  )}
                  <button
                    className={`${styles.cardActionBtn} ${styles.cardActionBtnDanger}`}
                    title="格式化粉碎"
                    onClick={(e) => {

 e.stopPropagation(); setDeleteTargetId(assistant.id); }}
                  >
                    <Trash2 size={15}/>
                  </button>
                </div>

                {/* Header Information */}
                <div className={styles.cardHeader}>
                  <div className={styles.cardAvatar}>
                    {assistant.emoji || '🤖'}
                  </div>
                  <div className={styles.cardInfo}>
                    <div className={styles.cardNameRow}>
                      <span className={styles.cardName} title={assistant.name}>{assistant.name}</span>
                      {isPinned && <Pin size={14} color="var(--color-primary, #5BA8F5)" style={{marginLeft: 6, opacity: 0.8}}/>}
                    </div>
                  </div>
                </div>

                {/* Main Readout */}
                <div className={styles.cardDesc}>
                  {assistant.description || assistant.systemPrompt || t('agent.assistant.no_prompt', '⚠️ 空白系统协议流...')}
                </div>

                {/* Footnotes & Metadata Tracking */}
                <div className={styles.cardMeta}>
                  <span className={styles.cardMetaTag}>
                    <Activity size={12}/> CTX: {formatContextWindow(assistant.contextWindow)}
                  </span>
                  {assistant.modelId && (
                    <span className={styles.cardMetaTag} title={assistant.providerId}>
                      ✨ {assistant.modelId.length > 14 ? assistant.modelId.substring(0,14)+'...' : assistant.modelId}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      </div>

      {/* Delete Confirm Modal */}
      {deleteTargetId !== null && (
        <div
          className={styles.dialogOverlay}
          onClick={() => setDeleteTargetId(null)}
        >
          <div
            className={styles.dialogBox}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.dialogTitle}>
              {t('agent.assistant.delete_confirm_title', '特级警告：抹除智能体？')}
            </div>
            <div className={styles.dialogText}>
              {t(
                'agent.assistant.delete_confirm_content',
                '彻底删除该助手后关联设置将遗失。这是一个不可逆操作！',
              )}
            </div>
            <div className={styles.dialogActions}>
              <button
                className={`${styles.dialogBtn} ${styles.dialogBtnCancel}`}
                onClick={() => setDeleteTargetId(null)}
              >
                {t('common.cancel', '暂缓执行')}
              </button>
              <button
                className={`${styles.dialogBtn} ${styles.dialogBtnDanger}`}
                onClick={handleConfirmDelete}
              >
                {t('common.delete', '授权粉碎')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
