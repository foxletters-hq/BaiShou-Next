import React, { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Edit3, Trash2, Calendar, Tag, Save, X } from 'lucide-react'
import { MarkdownRenderer } from '../MarkdownRenderer'
import { CodeMirrorEditor } from '../DiaryEditor'
import type { SummaryItem } from './gallery-panel.types'
import { TYPE_I18N_MAP, formatDateRange } from './gallery-panel.utils'

interface GallerySummaryDetailProps {
  summary?: SummaryItem
  language: string
  isEditing: boolean
  editContent: string
  isSaving: boolean
  canInlineEdit: boolean
  onEditContentChange: (content: string) => void
  onStartInlineEdit: (content: string) => void
  onEdit?: (id: string) => void
  onDelete?: (id: string) => void
  onSave: () => void
  onCancel: () => void
}

export const GallerySummaryDetail: React.FC<GallerySummaryDetailProps> = ({
  summary,
  language,
  isEditing,
  editContent,
  isSaving,
  canInlineEdit,
  onEditContentChange,
  onStartInlineEdit,
  onEdit,
  onDelete,
  onSave,
  onCancel
}) => {
  const { t } = useTranslation()
  const detailRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (detailRef.current) {
      detailRef.current.scrollTop = 0
    }
  }, [summary?.id, isEditing])

  return (
    <div ref={detailRef} className={`gallery-detail ${isEditing ? 'editing' : ''}`}>
      {summary ? (
        <>
          <div className="gallery-detail-header">
            <div className="gallery-detail-meta">
              <span className="gallery-detail-type-badge">
                <Tag size={12} />
                {t(TYPE_I18N_MAP[summary.type] || summary.type, summary.type)}
              </span>
              <span className="gallery-detail-date">
                <Calendar size={12} />
                {formatDateRange(summary, language, t)}
              </span>
            </div>
            <div className="gallery-detail-actions">
              {isEditing ? (
                <>
                  <button
                    className="gallery-action-btn"
                    onClick={onSave}
                    disabled={isSaving}
                    title={t('common.save', '保存')}
                  >
                    <Save size={16} />
                  </button>
                  <button
                    className="gallery-action-btn"
                    onClick={onCancel}
                    disabled={isSaving}
                    title={t('common.cancel', '取消')}
                  >
                    <X size={16} />
                  </button>
                </>
              ) : (
                <>
                  <button
                    className="gallery-action-btn"
                    onClick={() => {
                      if (canInlineEdit) {
                        onStartInlineEdit(summary.content)
                      } else {
                        onEdit?.(String(summary.id))
                      }
                    }}
                    title={t('common.edit', '编辑')}
                  >
                    <Edit3 size={16} />
                  </button>
                  <button
                    className="gallery-action-btn danger"
                    onClick={() => onDelete?.(String(summary.id))}
                    title={t('common.delete', '删除')}
                  >
                    <Trash2 size={16} />
                  </button>
                </>
              )}
            </div>
          </div>
          <div className={`gallery-detail-content ${isEditing ? 'editing' : ''}`}>
            {isEditing ? (
              <CodeMirrorEditor content={editContent} onChange={onEditContentChange} />
            ) : (
              <MarkdownRenderer content={summary.content} />
            )}
          </div>
        </>
      ) : (
        <div className="gallery-detail-empty">
          <Edit3 size={48} className="gallery-empty-icon" />
          <div className="gallery-empty-text">
            {t('gallery.select_summary', '选择一个总结查看详情')}
          </div>
        </div>
      )}
    </div>
  )
}
