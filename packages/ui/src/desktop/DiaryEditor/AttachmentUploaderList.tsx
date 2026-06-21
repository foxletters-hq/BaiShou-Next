import React from 'react'
import { ContextMenu } from '../ContextMenu'
import type { ContextMenuItem } from '../ContextMenu'
import type { DiaryAttachmentItem } from './attachment-uploader.types'
import { CopyIcon, DeleteIcon, FolderIcon, InsertIcon } from './attachment-uploader.icons'

interface AttachmentUploaderListProps {
  attachments: DiaryAttachmentItem[]
  getContextMenuItems: (attachment: DiaryAttachmentItem) => ContextMenuItem[]
  onInsertAttachment: (attachment: DiaryAttachmentItem) => void
  onCopy: (attachment: DiaryAttachmentItem) => void
  onOpenFolder: (attachment: DiaryAttachmentItem) => void
  onDelete: (attachment: DiaryAttachmentItem) => void
  insertTitle: string
  copyTitle: string
  openFolderTitle: string
  deleteTitle: string
}

export function AttachmentUploaderList({
  attachments,
  getContextMenuItems,
  onInsertAttachment,
  onCopy,
  onOpenFolder,
  onDelete,
  insertTitle,
  copyTitle,
  openFolderTitle,
  deleteTitle
}: AttachmentUploaderListProps) {
  if (attachments.length === 0) return null

  return (
    <div className="attachment-list">
      {attachments.map((att) => (
        <ContextMenu key={att.id} items={getContextMenuItems(att)}>
          <div className="attachment-item">
            <div className="attachment-info">
              {att.isImage && <span className="attachment-icon">🖼️</span>}
              {att.isVideo && <span className="attachment-icon">🎬</span>}
              {att.isAudio && <span className="attachment-icon">🎵</span>}
              {!att.isImage && !att.isVideo && !att.isAudio && (
                <span className="attachment-icon">📎</span>
              )}
              <span className="attachment-name" title={att.fileName}>
                {att.fileName}
              </span>
            </div>
            <div className="attachment-actions">
              <button
                className="attachment-action-btn"
                onClick={() => onInsertAttachment(att)}
                title={insertTitle}
              >
                <InsertIcon />
              </button>
              <button
                className="attachment-action-btn"
                onClick={() => onCopy(att)}
                title={copyTitle}
              >
                <CopyIcon />
              </button>
              <button
                className="attachment-action-btn"
                onClick={() => onOpenFolder(att)}
                title={openFolderTitle}
              >
                <FolderIcon />
              </button>
              <button
                className="attachment-action-btn delete"
                onClick={() => onDelete(att)}
                title={deleteTitle}
              >
                <DeleteIcon />
              </button>
            </div>
          </div>
        </ContextMenu>
      ))}
    </div>
  )
}
