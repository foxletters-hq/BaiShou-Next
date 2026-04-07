import { useTranslation } from 'react-i18next';
import React, { useState } from 'react';
import './TagInput.css';

interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
}

// TODO: [Agent1-Dependency] 合并后替换为 import { useTranslation } from 'react-i18next'


export const TagInput: React.FC<TagInputProps> = ({ tags, onChange }) => {
  const { t } = useTranslation();
  const [inputValue, setInputValue] = useState('');

  const saveCurrentTag = () => {
    const newTag = inputValue.trim().replace(/^#/, '');
    if (newTag && !tags.includes(newTag)) {
      onChange([...tags, newTag]);
    }
    setInputValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      saveCurrentTag();
    } else if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
      onChange(tags.slice(0, -1));
    }
  };

  const handleBlur = () => {
    if (inputValue.trim()) saveCurrentTag();
  };

  const removeTag = (indexToRemove: number) => {


    onChange(tags.filter((_, index) => index !== indexToRemove));
  };

  return (
    <div className="tag-input-container">
      {tags.map((tag, index) => (
        <span key={index} className="tag-bubble">
          #{tag}
          <button className="tag-remove" onClick={() => removeTag(index)}>&times;</button>
        </span>
      ))}
      <input
        type="text"
        className="tag-input"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        placeholder={tags.length === 0 ? t('diary.editor_tag_placeholder', '输入标签，按回车保存') : ''}
      />
    </div>
  );
};
