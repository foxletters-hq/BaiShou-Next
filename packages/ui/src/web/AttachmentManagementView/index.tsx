import React from 'react';
import styles from './AttachmentManagementView.module.css';

export interface AttachmentItem {
  id: string;
  name: string;
  size: string;
  type: string;
  date: string;
}

export interface AttachmentManagementViewProps {
  attachments: AttachmentItem[];
  onDelete: (id: string) => void;
}

export const AttachmentManagementView: React.FC<AttachmentManagementViewProps> = ({
  attachments,
  onDelete
}) => {
  return (
    <div className={styles.container}>
       <div className={styles.header}>
          <h2 className={styles.title}>核心系统附录库 (Attachment Center)</h2>
          <p className={styles.subtitle}>跨域文件、多媒体记忆的统管收容站。</p>
       </div>
       
       <div className={styles.grid}>
          {attachments.length === 0 ? (
             <div className={styles.empty}>当前工作区无任何留存的附件。</div>
          ) : (
             attachments.map(att => (
               <div key={att.id} className={styles.card}>
                 <div className={styles.cardIcon}>
                   {att.type.includes('image') ? '🖼️' : '📄'}
                 </div>
                 <div className={styles.cardInfo}>
                   <div className={styles.cardName} title={att.name}>{att.name}</div>
                   <div className={styles.cardMeta}>{att.size} • {att.date}</div>
                 </div>
                 <button className={styles.deleteBtn} onClick={() => onDelete(att.id)}>✕</button>
               </div>
             ))
          )}
       </div>
    </div>
  );
};
