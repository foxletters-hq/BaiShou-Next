import React from 'react';
import styles from './MarkdownToolbar.module.css';

interface MarkdownToolbarProps {
  onAction: (format: string) => void;
  position?: { x: number; y: number };
  visible: boolean;
}

export const MarkdownToolbar: React.FC<MarkdownToolbarProps> = ({ 
  onAction, 
  position, 
  visible 
}) => {
  if (!visible) return null;

  const handleAction = (e: React.MouseEvent, format: string) => {
    e.preventDefault();
    onAction(format);
  };

  return (
     <div 
       className={styles.toolbar}
       style={position ? { top: position.y - 45, left: position.x - 120 } : {}}
     >
        <button className={styles.toolBtn} onClick={(e) => handleAction(e, 'bold')} title="加粗 (Ctrl+B)">B</button>
        <button className={styles.toolBtn} onClick={(e) => handleAction(e, 'italic')} title="斜体 (Ctrl+I)">I</button>
        <button className={styles.toolBtn} onClick={(e) => handleAction(e, 'strikethrough')} title="删除线">S</button>
        <div className={styles.divider} />
        <button className={styles.toolBtn} onClick={(e) => handleAction(e, 'header')} title="转换为标题">H</button>
        <button className={styles.toolBtn} onClick={(e) => handleAction(e, 'quote')} title="引用">”</button>
        <div className={styles.divider} />
        <button className={styles.toolBtn} onClick={(e) => handleAction(e, 'link')} title="插入链接">🔗</button>
        <button className={styles.toolBtn} onClick={(e) => handleAction(e, 'code')} title="行内代码">&lt;/&gt;</button>
     </div>
  );
};
