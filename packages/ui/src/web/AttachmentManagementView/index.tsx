import React, { useState } from 'react';
import styles from './AttachmentManagementView.module.css';

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
    const confirmText = window.confirm(`防呆确定：您将从硬盘上永久抹杀被选定的 ${selectedIds.size} 个附录库会话文件夹！\n删除后不可找回。该操作只删附件不删纯文本记忆。继续？`);
    if (!confirmText) return;

    setIsDeleting(true);
    try {
      await onDeleteSelected(Array.from(selectedIds));
      alert('清除完毕，物理存储已释放。');
      setSelectedIds(new Set());
    } catch (e: any) {
      alert(`删除过程抛出异常：${e.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className={styles.container}>
       <div className={styles.header}>
          <div className={styles.titleInfo}>
             <h3 className={styles.title}>核心系统附录库 (Attachment Center)</h3>
             <p className={styles.subtitle}>跨域文件、媒体记忆帧的物理留存中枢。红色条目即“遗落的孤岛孤标文件”。</p>
          </div>
       </div>

       {/* 概览大盘 */}
       <div className={styles.statsBoard}>
          <div className={styles.statBox}>
             <span className={styles.statLabel}>宿命总吞吐量</span>
             <span className={styles.statValue}>{totalSizeMB.toFixed(2)} <small>MB</small></span>
          </div>
          <div className={styles.statDivider} />
          <div className={styles.statBox}>
             <span className={styles.statLabel}>散落游离碎片总计</span>
             <span className={styles.statValue}>{totalFiles} <small>Files</small></span>
          </div>
          <div className={styles.statDivider} />
          <div className={styles.statBox}>
             <span className={`${styles.statLabel} ${styles.dangerTextLabel}`}>无对证的幽灵数据 (Orphans)</span>
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
               onClick={() => { setActiveTab('all'); setSelectedIds(new Set()); }}
             >
               🪐 恒星群合集 <span className={styles.badge}>{attachments.length}</span>
             </button>
             <button 
               className={`${styles.tabBtn} ${activeTab === 'orphans' ? styles.tabActive : ''}`}
               onClick={() => { setActiveTab('orphans'); setSelectedIds(new Set()); }}
             >
               🛸 漂流无归档陨石区 <span className={styles.badgeDanger}>{orphans.length}</span>
             </button>
          </div>
          
          <button className={styles.selectAllBtn} onClick={handleSelectAll} disabled={displayList.length === 0}>
             {displayList.length > 0 && selectedIds.size === displayList.length ? '取消群选' : '框选全视域'}
          </button>
       </div>

       {/* 档案列表 */}
       <div className={styles.listArea}>
          {displayList.length === 0 ? (
             <div className={styles.empty}>
                <div className={styles.emptyIcon}>{activeTab === 'orphans' ? '🎐' : '🗂️'}</div>
                <div className={styles.emptyText}>{activeTab === 'orphans' ? '未感测到任何未能关联归档的孤岛件。' : '当前工作区无任何留存的附件。'}</div>
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
                       <span className={styles.fileCountHint}>{att.fileCount} 个档案封套</span>
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
               您已锁定 <span className={styles.highlight}>{selectedIds.size}</span> 个附件组列。
            </div>
            <button 
               className={styles.massiveDeleteBtn} 
               onClick={handleDelete}
               disabled={isDeleting}
            >
               {isDeleting ? '☄️ 碎星武器发射中...' : '☄️ 从物理层面碾碎遣除 (EXECUTE)'}
            </button>
         </div>
       )}
    </div>
  );
};
