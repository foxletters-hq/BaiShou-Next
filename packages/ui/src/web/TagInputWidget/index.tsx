import React, { useState, KeyboardEvent } from 'react';
import styles from './TagInputWidget.module.css';
import { useTranslation } from 'react-i18next';


interface TagInputWidgetProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
}

export const TagInputWidget: React.FC<TagInputWidgetProps> = ({ 
  tags, 
  onChange, 
  placeholder 
}) => {
  const { t } = useTranslation();
  const [inputValue, setInputValue] = useState('');

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
  if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const newTag = inputValue.trim().replace(/,/g, '');
      if (newTag && !tags.includes(newTag)) {
        onChange([...tags, newTag]);
      }
      setInputValue('');
    } else if (e.key === 'Backspace' && inputValue === '' && tags.length > 0) {
      // Remove last tag on backspace if input is empty
      const newTags = [...tags];
      newTags.pop();
      onChange(newTags);
    }
  };

  const removeTag = (indexToRemove: number) => {


    onChange(tags.filter((_, index) => index !== indexToRemove));
  };

  return (
    <div className={styles.container}>
       <div className={styles.tagsArea}>
          {tags.map((tag, index) => (
            <div key={`${tag}-${index}`} className={styles.tagBadge}>
              <span className={styles.hash}>#</span>
              <span>{tag}</span>
              <button 
                className={styles.removeBtn} 
                onClick={() => removeTag(index)}
              >
                ✕
              </button>
            </div>
          ))}
          <input
             type="text"
             value={inputValue}
             onChange={(e) => setInputValue(e.target.value)}
             onKeyDown={handleKeyDown}
             placeholder={tags.length === 0 ? (placeholder || t("common.enter_tags", "输入标签并按回车添加...")) : ""}
             className={styles.inputField}
          />
       </div>
    </div>
  );
};
