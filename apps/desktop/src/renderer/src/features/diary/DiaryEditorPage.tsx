import React from 'react';
import { DiaryEditor } from '@baishou/ui';
import { useDiaryEditorMock } from './hooks/useDiaryEditorMock';
import './DiaryEditorPage.css';

export const DiaryEditorPage: React.FC = () => {
  const { state, actions } = useDiaryEditorMock('以前写过的一段文字...', true); // Mock appendOnLoad

  return (
    <div className="diary-editor-page-container">
      <DiaryEditor 
        content={state.content}
        tags={state.tags}
        selectedDate={state.selectedDate}
        onContentChange={actions.setContent}
        onTagsChange={actions.setTags}
        onDateChange={actions.setSelectedDate}
        onSave={actions.handleSave}
        onCancel={actions.handleCancel}
      />
    </div>
  );
};
