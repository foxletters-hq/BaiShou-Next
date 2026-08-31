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
        <div className="diary-editor-skeleton-appbar-center">
          <div className="diary-editor-skeleton-pill diary-editor-skeleton-pill--title" />
        </div>
        <div className="diary-editor-skeleton-pill diary-editor-skeleton-pill--action" />
      </div>

      <div className="diary-editor-skeleton-body">
        <div className="diary-editor-skeleton-meta">
          <div className="diary-editor-skeleton-meta-left">
            <div className="diary-editor-skeleton-pill" />
            <div className="diary-editor-skeleton-pill" />
            <div className="diary-editor-skeleton-square" />
          </div>
          <div className="diary-editor-skeleton-meta-spacer" />
          <div className="diary-editor-skeleton-square" />
        </div>

        <div className="diary-editor-skeleton-content">
          <div className="diary-editor-skeleton-lines">
            <div className="diary-editor-skeleton-line" style={{ width: '28%' }} />
            <div className="diary-editor-skeleton-line" style={{ width: '62%' }} />
            <div className="diary-editor-skeleton-line" style={{ width: '88%' }} />
            <div className="diary-editor-skeleton-line" style={{ width: '74%' }} />
            <div className="diary-editor-skeleton-line" style={{ width: '46%' }} />
          </div>
          <div className="diary-editor-skeleton-toolbar">
            <div className="diary-editor-skeleton-square diary-editor-skeleton-square--sm" />
            <div className="diary-editor-skeleton-square diary-editor-skeleton-square--sm" />
            <div className="diary-editor-skeleton-square diary-editor-skeleton-square--sm" />
            <div className="diary-editor-skeleton-square diary-editor-skeleton-square--sm" />
            <div className="diary-editor-skeleton-square diary-editor-skeleton-square--sm" />
            <div className="diary-editor-skeleton-square diary-editor-skeleton-square--sm" />
          </div>
        </div>
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
      animate={isLeaving ? { opacity: 0, y: 10, scale: 0.992 } : { opacity: 1, y: 0, scale: 1 }}
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

    </motion.div>
  )
}
