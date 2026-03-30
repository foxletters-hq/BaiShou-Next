import React, { useState } from 'react';
import './DiaryEditorAppBarTitle.css';

interface DiaryEditorAppBarTitleProps {
  isSummaryMode: boolean;
  selectedDate: Date;
  onDateChanged: (date: Date) => void;
  // Dashboard summaries props ignored for basic mock
}

export const DiaryEditorAppBarTitle: React.FC<DiaryEditorAppBarTitleProps> = ({
  isSummaryMode,
  selectedDate,
  onDateChanged
}) => {
  const [showPicker, setShowPicker] = useState(false);

  const formattedDate = selectedDate.toLocaleDateString('zh-CN', {
    month: 'long',
    day: 'numeric',
    weekday: 'long'
  });

  return (
    <div className="diary-editor-app-bar-title" onClick={() => setShowPicker(!showPicker)}>
      {!isSummaryMode ? (
        <div className="title-content">
          <span className="title-text">{formattedDate}</span>
          <span className="title-icon">▼</span>
        </div>
      ) : (
        <div className="title-content">
          <span className="title-text">编辑总结</span>
        </div>
      )}
      
      {showPicker && !isSummaryMode && (
        <div className="date-picker-mock">
          {/* Mock Date picker dropdown */}
          <input 
            type="date" 
            onChange={(e) => {
              if (e.target.value) {
                onDateChanged(new Date(e.target.value));
              }
              setShowPicker(false);
            }} 
          />
        </div>
      )}
    </div>
  );
};
