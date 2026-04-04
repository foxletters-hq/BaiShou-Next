import { useTranslation } from 'react-i18next';
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
    <div className="diary-editor-scaffold">
      <div className="de-app-bar">
        <button className="de-icon-btn" onClick={onCancel}>
          <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
        </button>
        <div className="de-app-bar-center">
          <DiaryEditorAppBarTitle 
            isSummaryMode={isSummaryMode} 
            selectedDate={selectedDate} 
            onDateChanged={onDateChange} 
          />
        </div>
        <div className="de-app-bar-actions">
          <button className="de-save-btn" onClick={() => onSave?.(content, tags, selectedDate)}>
            {t('common.save') || '保存'}
          </button>
        </div>
      </div>

      <div className="de-body-column">
        <div className="de-expanded-list">
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

        <div className="de-bottom-toolbar-wrap">
          <MarkdownToolbar 
            isPreview={isPreview} 
            onTogglePreview={() => setIsPreview(!isPreview)} 
            onHideKeyboard={() => textAreaRef.current?.blur()}
            onInsertText={handleInsertText}
          />
        </div>
      </div>
    </div>
  );
};
