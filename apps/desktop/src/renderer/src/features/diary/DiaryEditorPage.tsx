import React, { useCallback, useEffect } from 'react'
import { DiaryEditor } from '@baishou/ui'
import './DiaryEditorPage.css'
import { useDiaryEditorPage } from './hooks/useDiaryEditorPage'
import { useTts } from '../agent/hooks/useTts'
import { motion } from 'framer-motion'

const DIARY_TTS_PLAYBACK_ID = 'diary-editor'

function DiaryEditorLoadingSkeleton() {
  return (
    <div className="diary-editor-skeleton" aria-busy="true" aria-label="Loading">
      <div className="diary-editor-skeleton-appbar">
        <div className="diary-editor-skeleton-circle" />
        <div className="diary-editor-skeleton-pill diary-editor-skeleton-pill--title" />
        <div className="diary-editor-skeleton-pill diary-editor-skeleton-pill--action" />
      </div>
      <div className="diary-editor-skeleton-meta">
        <div className="diary-editor-skeleton-pill" />
        <div className="diary-editor-skeleton-pill" />
        <div className="diary-editor-skeleton-circle diary-editor-skeleton-circle--sm" />
      </div>
      <div className="diary-editor-skeleton-card">
        <div className="diary-editor-skeleton-line" style={{ width: '28%' }} />
        <div className="diary-editor-skeleton-line" style={{ width: '62%' }} />
        <div className="diary-editor-skeleton-line" style={{ width: '88%' }} />
        <div className="diary-editor-skeleton-line" style={{ width: '74%' }} />
        <div className="diary-editor-skeleton-line" style={{ width: '46%' }} />
      </div>
    </div>
  )
}

export const DiaryEditorPage: React.FC = () => {
  const editor = useDiaryEditorPage()
  const tts = useTts(editor.t)

  useEffect(() => {
    return () => {
      tts.stopTts()
    }
  }, [tts])

  const handleReadAloud = useCallback(() => {
    void tts.handleTtsReadAloud(editor.content, DIARY_TTS_PLAYBACK_ID)
  }, [editor.content, tts])

  if (editor.isLoading) {
    return <DiaryEditorLoadingSkeleton />
  }

  const isLeaving = editor.savePhase === 'leaving'

  return (
    <motion.div
      className="diary-editor-page-container"
      style={{
        pointerEvents: editor.savePhase === 'idle' ? 'auto' : 'none'
      }}
      initial={{ opacity: 0, y: 10 }}
      animate={
        isLeaving
          ? { opacity: 0, y: 10, scale: 0.992 }
          : { opacity: 1, y: 0, scale: 1 }
      }
      transition={{
        duration: isLeaving ? 0.32 : 0.28,
        ease: [0.22, 1, 0.36, 1]
      }}
    >
      <DiaryEditor
        content={editor.content}
        selectedDate={editor.selectedDate}
        attachmentBasePath={editor.attachmentBasePath}
        weather={editor.weather}
        mood={editor.mood}
        isFavorite={editor.isFavorite}
        mediaPaths={editor.mediaPaths}
        isSaving={editor.savePhase !== 'idle'}
        savePhase={editor.savePhase}
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
