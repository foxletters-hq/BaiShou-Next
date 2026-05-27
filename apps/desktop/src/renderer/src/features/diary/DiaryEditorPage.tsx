import React from 'react'
import { DiaryEditor } from '@baishou/ui'
import { motion } from 'framer-motion'
import './DiaryEditorPage.css'
import { DIARY_EDITOR_SAVE_EXIT_TRANSITION } from './diary-navigation'
import { useDiaryEditorPage } from './hooks/useDiaryEditorPage'

export const DiaryEditorPage: React.FC = () => {
  const editor = useDiaryEditorPage()

  if (editor.isLoading) {
    return (
      <div
        style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}
      >
        Loading...
      </div>
    )
  }

  return (
    <motion.div
      className="diary-editor-page-container"
      initial={{ opacity: 0, y: 30 }}
      animate={
        editor.isLeavingAfterSave
          ? { opacity: 0, y: 28, scale: 0.97 }
          : { opacity: 1, y: 0, scale: 1 }
      }
      transition={
        editor.isLeavingAfterSave
          ? DIARY_EDITOR_SAVE_EXIT_TRANSITION
          : { type: 'spring', damping: 25, stiffness: 200 }
      }
      onAnimationComplete={editor.handleSaveExitComplete}
    >
      <DiaryEditor
        content={editor.content}
        tags={editor.tags}
        selectedDate={editor.selectedDate}
        weather={editor.weather}
        isFavorite={editor.isFavorite}
        mediaPaths={editor.mediaPaths}
        onContentChange={editor.handleContentChange}
        onTagsChange={(newTags) => {
          editor.setTags(newTags)
          editor.setIsDirty(true)
        }}
        onDateChange={(newDate) => {
          editor.setSelectedDate(newDate)
          editor.setIsDirty(true)
        }}
        onWeatherChange={(v) => {
          editor.setWeather(v)
          editor.setIsDirty(true)
        }}
        onFavoriteChange={(v) => {
          editor.setIsFavorite(v)
          editor.setIsDirty(true)
        }}
        onMediaPathsChange={(v) => {
          editor.setMediaPaths(v)
          editor.setIsDirty(true)
        }}
        onSave={editor.handleSave}
        onCancel={editor.handleBack}
      />

      {editor.showExitConfirm && (
        <div
          className="diary-delete-modal-overlay"
          onClick={() => editor.setShowExitConfirm(false)}
        >
          <div className="diary-delete-modal" onClick={(e) => e.stopPropagation()}>
            <div className="dd-modal-title">{editor.t('common.confirm_leave', '确认离开')}</div>
            <div
              className="dd-modal-content"
              style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '8px' }}
            >
              {editor.t(
                'diary.editor_leave_confirm',
                '当前有尚未保存的文字，如果强行退出，将不会保存刚才键入的内容。确定要丢弃并离开吗？'
              )}
            </div>
            <div className="dd-modal-actions" style={{ marginTop: '24px' }}>
              <button className="dd-btn-cancel" onClick={() => editor.setShowExitConfirm(false)}>
                {editor.t('common.cancel', '我再写写')}
              </button>
              <button
                className="dd-btn-confirm dd-btn-confirm-danger"
                onClick={() => editor.goBackToSidebar()}
              >
                {editor.t('common.leave', '强行离开')}
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  )
}
