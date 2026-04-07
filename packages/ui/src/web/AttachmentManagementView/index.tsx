import React, { useState } from 'react';
import styles from './AttachmentManagementView.module.css';
import { useTranslation } from 'react-i18next';
import { useDialog } from '../Dialog';
import { useToast } from '../Toast/useToast';
import { 
  CheckCircle,
  FolderMinus,
  Folder,
  Trash2,
  CheckSquare
} from 'lucide-react';

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

  const formatSize = (mb: number) => {
    if (mb <= 0) return "0 B";
    if (mb < 1) return (mb * 1024).toFixed(2) + " KB";
    if (mb >= 1024) return (mb / 1024).toFixed(2) + " GB";
    return mb.toFixed(2) + " MB";
  };

  const handleDelete = async () => {
    if (selectedIds.size === 0) return;
    
    let confirmMsg = t('settings.attachment_delete_selected_confirm', '确定要删除选中的 {{count}} 个附件文件夹吗？此操作不可撤销。', { count: selectedIds.size });
    if (confirmMsg.includes('$count')) {
      confirmMsg = confirmMsg.replace('$count', selectedIds.size.toString());
    }
      
    const confirmed = await dialog.confirm(confirmMsg);
    if (!confirmed) return;

    setIsDeleting(true);
    try {
      const freedMB = Array.from(selectedIds).reduce((sum, id) => {
         const folder = attachments.find(a => a.id === id);
         return sum + (folder ? folder.sizeMB : 0);
      }, 0);
      
      await onDeleteSelected(Array.from(selectedIds));
      
      let successStr = t('settings.attachment_clear_completed', '清理完成，共释放 $size 空间', { size: formatSize(freedMB) });
      if (successStr.includes('$size')) {
        successStr = successStr.replace('$size', formatSize(freedMB));
      }
      toast.showSuccess(successStr);
      setSelectedIds(new Set());
    } catch (e: any) {
      toast.showError(`${t('common.error', '错误')}: ${e.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const deleteBtnLabel = (() => {
    let raw = t('settings.attachment_delete_selected', '删除已选 ({{count}})', { count: selectedIds.size });
    if (raw.includes('$count')) raw = raw.replace('$count', selectedIds.size.toString());
    return raw;
  })();

  return (
    <div className={styles.container}>
      {/* 概览大盘 */}
      <div className={styles.overviewCardWrapper}>
        <div className={styles.overviewCard}>
          <div className={styles.statColumn}>
            <span className={styles.statLabel}>{t('settings.attachment_total_size', '总占用空间')}</span>
            <span className={`${styles.statValue} ${styles.colorPrimary}`}>{formatSize(totalSizeMB)}</span>
          </div>
          <div className={styles.statDivider} />
          <div className={styles.statColumn}>
            <span className={styles.statLabel}>{t('settings.attachment_total_count', '附件总数')}</span>
            <span className={`${styles.statValue} ${styles.colorOnSurface}`}>{totalFiles}</span>
          </div>
          <div className={styles.statDivider} />
          <div className={styles.statColumn}>
            <span className={styles.statLabel}>{t('settings.attachment_orphans_size', '孤立附件体积')}</span>
            <span className={`${styles.statValue} ${orphanSizeMB > 0 ? styles.colorError : styles.colorOnSurface}`}>
              {formatSize(orphanSizeMB)}
            </span>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className={styles.toolbarWrapper}>
        <div className={styles.tabsRow}>
          <button 
            className={`${styles.actionBtn} ${activeTab === 'all' ? styles.btnFilled : styles.btnOutlined}`}
            onClick={() => {
              setActiveTab('all'); setSelectedIds(new Set()); 
            }}
          >
            {t('settings.attachment_tab_all', '全部附件')} {attachments.length}
          </button>
          <button 
            className={`${styles.actionBtn} ${activeTab === 'orphans' ? styles.btnFilled : styles.btnOutlined}`}
            onClick={() => {
              setActiveTab('orphans'); setSelectedIds(new Set()); 
            }}
          >
            {t('settings.attachment_tab_orphans', '孤立附件')} {orphans.length}
          </button>
        </div>
        
        <div className={styles.tabsRow}>
           {displayList.length > 0 && selectedIds.size > 0 && (
              <button 
                className={`${styles.actionBtn} ${styles.btnDangerFilled}`} 
                onClick={handleDelete}
                disabled={isDeleting}
              >
                <Trash2 size={16} /> 
                {deleteBtnLabel}
              </button>
           )}

           {displayList.length > 0 && (
             <button 
               className={`${styles.actionBtn} ${styles.btnOutlined}`} 
               onClick={handleSelectAll}
             >
               <CheckSquare size={16} />
               {selectedIds.size === displayList.length 
                 ? t('settings.attachment_deselect_all', '取消全选') 
                 : t('settings.attachment_select_all', '全选')}
             </button>
           )}
        </div>
      </div>

      {/* 列表主体 */}
      <div className={styles.listArea}>
        {displayList.length === 0 ? (
          <div className={styles.emptyState}>
            {activeTab === 'orphans' ? (
              <CheckCircle className={styles.emptyIcon} />
            ) : (
              <FolderMinus className={styles.emptyIcon} />
            )}
            <span className={styles.emptyText}>
              {activeTab === 'orphans' 
                ? t('settings.attachment_no_orphans', '暂时没有发现孤立的附件') 
                : t('settings.attachment_no_attachments', '当前空间没有任何附件')
              }
            </span>
          </div>
        ) : (
          displayList.map(folder => {
            const isChecked = selectedIds.has(folder.id);
            return (
              <div 
                key={folder.id} 
                className={`${styles.folderItem} ${isChecked ? styles.itemSelected : ''}`}
                onClick={() => toggleSelect(folder.id, !isChecked)}
              >
                <div className={styles.checkboxWrapper}>
                  <input 
                    type="checkbox" 
                    className={styles.customCheck} 
                    checked={isChecked}
                    onChange={(e) => toggleSelect(folder.id, e.target.checked)}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
                
                <div className={`${styles.folderIconBox} ${folder.isOrphan ? styles.folderIconBoxOrphan : ''}`}>
                  {folder.isOrphan ? <FolderMinus /> : <Folder />}
                </div>
                
                <div className={styles.folderInfo}>
                  <div className={styles.folderTitleRow}>
                    <span className={styles.folderTitle} title={folder.name || folder.id}>
                      {folder.name || folder.id}
                    </span>
                    {folder.isOrphan && (
                      <span className={styles.orphanLabel}>
                        {t('settings.attachment_orphan_label', '孤立')}
                      </span>
                    )}
                  </div>
                  <span className={styles.folderFilesSubtitle}>
                    {folder.fileCount} files
                  </span>
                </div>

                <div className={styles.folderSizeWrapper}>
                  <span className={styles.folderSizeValue}>{formatSize(folder.sizeMB)}</span>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  );
};
