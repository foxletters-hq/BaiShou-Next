import React, { useCallback, useEffect } from 'react'
import { DiaryEditor } from '@baishou/ui'
import './DiaryEditorPage.css'
import { useDiaryEditorPage } from './hooks/useDiaryEditorPage'
import { useTts } from '../agent/hooks/useTts'
import { motion } from 'framer-motion'

const DIARY_TTS_PLAYBACK_ID = 'diary-editor'

export const DiaryEditorPage: React.FC = () => {
  const editor = useDiaryEditorPage()
  const tts = useTts(editor.t)

  useEffect(() => {
    return () => {
      tts.stopTts()
    }
  }, [tts.stopTts])

  const handleReadAloud = useCallback(() => {
    void tts.handleTtsReadAloud(editor.content, DIARY_TTS_PLAYBACK_ID)
  }, [editor.content, tts.handleTtsReadAloud])

  if (editor.isLoading) {
    return (
      <div
        style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center' }}
      >
        Loading...
      </div>
    )
  }

  return (
    <motion.div
      className="diary-editor-page-container"
      style={{
        pointerEvents: editor.isSaving ? 'none' : 'auto'
      }}
      initial={{ opacity: 0, scale: 0.98, y: 8 }}
      animate={editor.isSaving ? { opacity: 0, scale: 0.98 } : { opacity: 1, scale: 1, y: 0 }}
      transition={{
        duration: editor.isSaving ? 0.15 : 0.2,
        ease: editor.isSaving ? 'easeInOut' : 'easeOut'
      }}
    >
      <DiaryEditor
        content={editor.content}
        selectedDate={editor.selectedDate}
        weather={editor.weather}
        mood={editor.mood}
        isFavorite={editor.isFavorite}
        mediaPaths={editor.mediaPaths}
        isSaving={editor.isSaving}
        onContentChange={editor.handleContentChange}
        onDateChange={editor.setSelectedDate}
        onWeatherChange={editor.setWeather}
        onMoodChange={editor.setMood}
        onFavoriteChange={editor.setIsFavorite}
        onMediaPathsChange={editor.setMediaPaths}
        onSave={editor.handleSave}
        onCancel={editor.handleBack}
        onReadAloud={handleReadAloud}
        isTtsPlaying={tts.ttsPlayingMsgId === DIARY_TTS_PLAYBACK_ID}
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
