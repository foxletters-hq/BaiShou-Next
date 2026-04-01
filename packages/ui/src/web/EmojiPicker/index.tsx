import React from 'react';
import { X } from 'lucide-react';
import styles from './EmojiPicker.module.css';
import { useTranslation } from 'react-i18next';

interface EmojiPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (emoji: string) => void;
}

const COMMON_EMOJIS = [
  '🤖', '👽', '👾', '🧠', '✨', '⚡', '🔥', '💠',
  '👨‍💻', '👩‍💻', '🧑‍🚀', '🕵️', '🧙', '🦹', '🦸', '👼',
  '🐶', '🐱', '🦊', '🦁', '🦉', '🐻', '🐼', '🐲',
  '😀', '😎', '🤓', '🧐', '🤩', '🤔', '🤫', '🫡',
  '💡', '🚀', '⭐', '☄️', '🔮', '🧿', '📚', '🧪',
  '🎭', '🎨', '🎬', '🎹', '🎮', '🎲', '🧩', '🏆'
];

export const EmojiPicker: React.FC<EmojiPickerProps> = ({
  isOpen,
  onClose,
  onSelect
}) => {
  const { t } = useTranslation();
  if (!isOpen) return null;

  return (
    <>
       <div className={styles.overlay} onClick={onClose} />
       <div className={styles.container} onClick={(e) => e.stopPropagation()}>
          <div className={styles.header}>
             <div className={styles.titleWrapper}>
                <span className={styles.title}>{t('common.emoji_title', '特派情绪粒子')}</span>
                <span className={styles.subtitle}>{t('common.emoji_subtitle', '选择该心智的外发特征图标')}</span>
             </div>
             <button className={styles.closeBtn} onClick={onClose}>
                <X size={16} strokeWidth={3} />
             </button>
          </div>
          <div className={styles.grid}>
             {COMMON_EMOJIS.map((emoji, i) => (
                <button 
                  key={i} 
                  className={styles.emojiBtn}
                  onClick={() => {
                     onSelect(emoji);
                     onClose();
                  }}
                  title={emoji}
                >
                   {emoji}
                </button>
             ))}
          </div>
       </div>
    </>
  );
};

// 为保持对后续 Dialog 调用的向下兼容（部分代码如果要求 EmojiPickerDialog 导出）
export const EmojiPickerDialog = EmojiPicker;
