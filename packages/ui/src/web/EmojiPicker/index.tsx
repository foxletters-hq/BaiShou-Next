import React from 'react';
import styles from './EmojiPicker.module.css';

interface EmojiPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (emoji: string) => void;
}

const COMMON_EMOJIS = [
  '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂',
  '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩',
  '😘', '😗', '☺️', '😚', '😋', '😛', '😜', '🤪',
  '🤔', '🤫', '🤭', '🥱', '🤗', '🫣', '😱', '😡',
  '✨', '🔥', '🎉', '👍', '👎', '👏', '🙌', '🫶',
  '❤️', '💔', '💯', '✅', '❌', '💡', '🚀', '⭐',
  '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼'
];

export const EmojiPicker: React.FC<EmojiPickerProps> = ({
  isOpen,
  onClose,
  onSelect
}) => {
  if (!isOpen) return null;

  return (
    <>
       <div className={styles.overlay} onClick={onClose} />
       <div className={styles.container} onClick={(e) => e.stopPropagation()}>
          <div className={styles.header}>
             <div className={styles.dragHandle} />
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
                >
                   {emoji}
                </button>
             ))}
          </div>
       </div>
    </>
  );
};
