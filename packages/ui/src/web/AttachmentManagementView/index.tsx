import React, { useState } from 'react';
import styles from './AttachmentManagementView.module.css';
import { useTranslation } from 'react-i18next';
import { useDialog } from '../Dialog';
import { useToast } from '../Toast/useToast';

export interface AttachmentItem {
  id: string;
  name: string;
  sizeMB: number;
  isOrphan: boolean;
  fileCount: number;
  date: string;
}

export interface AttachmentManagementViewProps {
  attachments: AttachmentItem[];
  onDeleteSelected: (ids: string[]) => Promise<void>;
}

export const AttachmentManagementView: React.FC<AttachmentManagementViewProps> = ({
  attachments,
  onDeleteSelected
}) => {
  const { t } = useTranslation();
  const dialog = useDialog();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<'all' | 'orphans'>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);

  const orphans = attachments.filter(a => a.isOrphan);
  
  // 汇总统计数据
  const totalSizeMB = attachments.reduce((sum, item) => sum + item.sizeMB, 0);
  const totalFiles = attachments.reduce((sum, item) => sum + item.fileCount, 0);
  const orphanSizeMB = orphans.reduce((sum, item) => sum + item.sizeMB, 0);

  const displayList = activeTab === 'all' ? attachments : orphans;

  const handleSelectAll = () => {
    if (selectedIds.size === displayList.length) {
       setSelectedIds(new Set());
    } else {
       setSelectedIds(new Set(displayList.map(a => a.id)));
    }
  };

  const toggleSelect = (id: string, isChecked: boolean) => {
    const clone = new Set(selectedIds);
    if (isChecked) clone.add(id);
    else clone.delete(id);
    setSelectedIds(clone);
  };

  const handleDelete = async () => {
    if (selectedIds.size === 0) return;
    const confirmed = await dialog.confirm(t('attachment.delete_confirm', '【操作确认】您将彻底删除选中的 {{count}} 个附件包。操作不可逆（仅删除文件，不影响聊天记录文本）。是否执行？', { count: selectedIds.size }));
    if (!confirmed) return;

    setIsDeleting(true);
    try {
      await onDeleteSelected(Array.from(selectedIds));
      toast.showSuccess('清除完毕，物理存储已释放。');
      setSelectedIds(new Set());
    } catch (e: any) {
      toast.showError(`删除过程抛出异常：${e.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className={styles.container}>
       <div className={styles.header}>
          <div className={styles.titleInfo}>
             <h3 className={styles.title}>{t('attachment.title', '附件与隔离数据管理')}</h3>
             <p className={styles.subtitle}>{t('attachment.desc', '集中管理所有对话产生的媒体及文件，被标记为红色的条目是已丢失会话依据的孤立碎片。')}</p>
          </div>
       </div>

       {/* 概览大盘 */}
       <div className={styles.statsBoard}>
          <div className={styles.statBox}>
             <span className={styles.statLabel}>{t('attachment.stat_total', '总计使用空间')}</span>
             <span className={styles.statValue}>{totalSizeMB.toFixed(2)} <small>MB</small></span>
          </div>
          <div className={styles.statDivider} />
          <div className={styles.statBox}>
             <span className={styles.statLabel}>{t('attachment.stat_orphans', '孤立碎片体积')}</span>
             <span className={styles.statValue}>{totalFiles} <small>Files</small></span>
          </div>
          <div className={styles.statDivider} />
          <div className={styles.statBox}>
             <span className={`${styles.statLabel} ${styles.dangerTextLabel}`}>{t('attachment.stat_orphans_count', '无记录对证的孤立文件')}</span>
             <span className={`${styles.statValue} ${orphanSizeMB > 0 ? styles.dangerText : ''}`}>
               {orphanSizeMB.toFixed(2)} <small>MB</small>
             </span>
          </div>
       </div>

       {/* 操作器栏 */}
       <div className={styles.toolbar}>
          <div className={styles.tabsRow}>
             <button 
               className={`${styles.tabBtn} ${activeTab === 'all' ? styles.tabActive : ''}`}
               onClick={() => {
                 setActiveTab('all'); setSelectedIds(new Set()); 
               }}
             >
               📁 {t('attachment.tab_all', '系统完整附件集')} <span className={styles.badge}>{attachments.length}</span>
             </button>
             <button 
               className={`${styles.tabBtn} ${activeTab === 'orphans' ? styles.tabActive : ''}`}
               onClick={() => {
                 setActiveTab('orphans'); setSelectedIds(new Set()); 
               }}
             >
               ⚠️ {t('attachment.tab_orphans', '无关联孤立区')} <span className={styles.badgeDanger}>{orphans.length}</span>
             </button>
          </div>
          
          <button className={styles.selectAllBtn} onClick={handleSelectAll} disabled={displayList.length === 0}>
             {displayList.length > 0 && selectedIds.size === displayList.length ? t('common.deselect_all', '取消全选') : t('common.select_all', '全选')}
          </button>
       </div>

       {/* 档案列表 */}
       <div className={styles.listArea}>
          {displayList.length === 0 ? (
             <div className={styles.empty}>
                <div className={styles.emptyIcon}>{activeTab === 'orphans' ? '🎐' : '🗂️'}</div>
                <div className={styles.emptyText}>{activeTab === 'orphans' ? t('attachment.no_orphans', '系统中不存在未关联的孤立文件。') : t('attachment.empty', '工作空间没有留存任何附件记录。')}</div>
             </div>
          ) : (
             displayList.map(att => {
                const isChecked = selectedIds.has(att.id);
                return (
                 <div key={att.id} className={`${styles.card} ${isChecked ? styles.cardChecked : ''} ${att.isOrphan ? styles.cardOrphan : ''}`}>
                   <div className={styles.cardSelectCol}>
                      <input 
                         type="checkbox" className={styles.customCheck} 
                         checked={isChecked}
                         onChange={(e) => toggleSelect(att.id, e.target.checked)}
                      />
                   </div>
                   
                   <div className={`${styles.cardIconBox} ${att.isOrphan ? styles.cardIconBoxOrphan : ''}`}>
                      {att.isOrphan ? '🚧' : '📂'}
                   </div>
                   
                   <div className={styles.cardMain}>
                     <div className={styles.cardHeaderRow}>
                       <span className={styles.cardName} title={att.name}>{att.name || att.id}</span>
                       {att.isOrphan && <span className={styles.orphanTag}>ORPHAN</span>}
                     </div>
                     <div className={styles.cardSubRow}>
                       <span className={styles.fileCountHint}>{t('attachment.file_count_badge', '{{count}} 件物理档案', { count: att.fileCount })}</span>
                     </div>
                   </div>

                   <div className={styles.cardSizeBox}>
                      <div className={styles.cardSize}>{att.sizeMB.toFixed(2)} MB</div>
                      <div className={styles.cardDate}>{att.date}</div>
                   </div>
                 </div>
               )
             })
          )}
       </div>

       {/* 底部悬浮删除面板 (条件显示) */}
       {selectedIds.size > 0 && (
         <div className={styles.massActionFooter}>
            <div className={styles.footerInfo}>
               {t('attachment.selected_count', '已选择')} <span className={styles.highlight}>{selectedIds.size}</span> {t('attachment.selected_count_suffix', '个组列.')}
            </div>
            <button 
               className={styles.massiveDeleteBtn} 
               onClick={handleDelete}
               disabled={isDeleting}
            >
               {isDeleting ? t('attachment.deleting', '🗑️ 彻底删除执行中...') : t('attachment.delete_btn', '🗑️ 从磁盘执行删除')}
            </button>
         </div>
       )}
    </div>
  );
};
