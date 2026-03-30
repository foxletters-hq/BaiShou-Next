import React, { useState, useRef } from 'react';
import { MarkdownToolbar } from '../MarkdownToolbar/MarkdownToolbar';
import { DiaryEditorAppBarTitle } from '../DiaryEditorAppBarTitle/DiaryEditorAppBarTitle';
import { TagInput } from '../TagInput';
import { MarkdownRenderer } from '../MarkdownRenderer';
import './DiaryEditor.css';

interface DiaryEditorProps {
  content: string;
  tags: string[];
  selectedDate: Date;
  isSummaryMode?: boolean;
  onContentChange: (content: string) => void;
  onTagsChange: (tags: string[]) => void;
  onDateChange: (date: Date) => void;
  onSave?: (content: string, tags: string[], date: Date) => void;
  onCancel?: () => void;
}

// TODO: [Agent1-Dependency] 替换
const useTranslation = (): { t: (key: string) => string } => ({
  t: (key: string) => key,
});

export const DiaryEditor: React.FC<DiaryEditorProps> = ({
  content,
  tags,
  selectedDate,
  isSummaryMode = false,
  onContentChange,
  onTagsChange,
  onDateChange,
  onSave,
  onCancel,
}) => {
  const { t } = useTranslation();
  const [isPreview, setIsPreview] = useState(false);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  const handleInsertText = (prefix: string, suffix: string = '') => {
    const el = textAreaRef.current;
    if (!el) {
      onContentChange(content + '\n' + prefix + suffix);
      return;
    }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const val = el.value;
    const selectedText = val.substring(start, end);
    
    const newText = val.substring(0, start) + prefix + selectedText + suffix + val.substring(end);
    onContentChange(newText);
    
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + prefix.length, end + prefix.length);
    }, 0);
  };

  return (
    <div className="diary-editor-container">
      <div className="de-app-bar">
        <button className="de-icon-btn" onClick={onCancel}>←</button>
        <div className="de-app-bar-center">
          <DiaryEditorAppBarTitle 
            isSummaryMode={isSummaryMode} 
            selectedDate={selectedDate} 
            onDateChanged={onDateChange} 
          />
        </div>
        <button className="de-save-btn" onClick={() => onSave?.(content, tags, selectedDate)}>
          {t('common.save') || '保存'}
        </button>
      </div>

      <div className="de-body">
        <div className="de-scroll-area">
          {!isSummaryMode && (
            <div className="de-tags-section">
              <TagInput tags={tags} onChange={onTagsChange} />
            </div>
          )}

          <div className="de-content-section">
            {!isPreview ? (
              <textarea
                ref={textAreaRef}
                className="de-textarea"
                value={content}
                onChange={(e) => onContentChange(e.target.value)}
                placeholder={t('diary.editor_hint') || '记录下这一刻...'}
              />
            ) : (
              <div className="de-preview">
                <MarkdownRenderer content={content} />
              </div>
            )}
          </div>
        </div>

        <MarkdownToolbar 
          isPreview={isPreview} 
          onTogglePreview={() => setIsPreview(!isPreview)} 
          onHideKeyboard={() => textAreaRef.current?.blur()}
          onInsertText={handleInsertText}
        />
      </div>
    </div>
  );
};
