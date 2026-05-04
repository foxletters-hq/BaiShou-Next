import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './EmojiPickerDialog.module.css';

const COMMON_EMOJIS = [
  '👍', '👎', '❤️', '🔥', '😂', '🥺', '🎉', '🚀',
  '✔️', '👀', '💡', '💯', '🙏', '👏', '🧠', '✨'
];

interface EmojiPickerDialogProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

export const EmojiPickerDialog: React.FC<EmojiPickerDialogProps> = ({ onSelect, onClose }) => {
  const { t } = useTranslation();
  return (
    <>
      <div className={styles.overlay} onClick={onClose} />
      <div className={styles.dialog}>
        <div className={styles.header}>
           <span className={styles.title}>{t('emojiPicker.respondToMessage', '回应此消息')}</span>
           <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>
        <div className={styles.grid}>
           {COMMON_EMOJIS.map(emoji => (
             <button 
               key={emoji} 
               className={styles.emojiBtn}
               onClick={() => {
                 onSelect(emoji);
                 onClose();
               }}
             >
               {emoji}
             </button>
           ))}
        </div>
      </div>
    </>
  );
};
