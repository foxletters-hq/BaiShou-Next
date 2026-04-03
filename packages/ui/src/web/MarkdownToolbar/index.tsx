import React from 'react';
import styles from './MarkdownToolbar.module.css';
import { useTranslation } from 'react-i18next';


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
  const { t } = useTranslation();
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
        <button className={styles.toolBtn} onClick={(e) => handleAction(e, 'bold')} title={t('markdown.bold', '加粗 (Ctrl+B)')}>B</button>
        <button className={styles.toolBtn} onClick={(e) => handleAction(e, 'italic')} title={t('markdown.italic', '斜体 (Ctrl+I)')}>I</button>
        <button className={styles.toolBtn} onClick={(e) => handleAction(e, 'strikethrough')} title={t('markdown.strikethrough', '删除线')}>S</button>
        <div className={styles.divider} />
        <button className={styles.toolBtn} onClick={(e) => handleAction(e, 'header')} title={t('markdown.header', '标题')}>H</button>
        <button className={styles.toolBtn} onClick={(e) => handleAction(e, 'quote')} title={t('markdown.quote', '引用')}>”</button>
        <div className={styles.divider} />
        <button className={styles.toolBtn} onClick={(e) => handleAction(e, 'link')} title={t('markdown.link', '插入链接')}>🔗</button>
        <button className={styles.toolBtn} onClick={(e) => handleAction(e, 'code')} title={t('markdown.inline_code', '行内代码')}>&lt;/&gt;</button>
     </div>
  );
};
