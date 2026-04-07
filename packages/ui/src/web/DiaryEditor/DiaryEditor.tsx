import { useTranslation } from 'react-i18next';
import React from 'react';
import { MilkdownEditorWrapper } from './MilkdownEditor';
import { DiaryEditorAppBarTitle } from '../DiaryEditorAppBarTitle/DiaryEditorAppBarTitle';
import { TagInput } from '../TagInput';
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
            {t('common.save', '保存')}
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

          <div className="de-content-section" data-color-mode="light">
            <MilkdownEditorWrapper
              content={content}
              onChange={(val) => { console.log('Milkdown onChange:', val); onContentChange(val || ''); }}
              placeholder={t('diary.editor_hint', '记录下这一刻...')}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
