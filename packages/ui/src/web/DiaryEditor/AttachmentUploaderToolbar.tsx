import React from 'react'
import { AttachIcon } from './attachment-uploader.icons'

interface AttachmentUploaderToolbarProps {
  isUploading: boolean
  onPickFiles: () => void
  uploadLabel: string
  attachLabel: string
  uploadingLabel: string
}

export function AttachmentUploaderToolbar({
  isUploading,
  onPickFiles,
  uploadLabel,
  attachLabel,
  uploadingLabel
}: AttachmentUploaderToolbarProps) {
  return (
    <div className="attachment-toolbar">
      <button
        className="attachment-btn"
        onClick={onPickFiles}
        disabled={isUploading}
        title={uploadLabel}
      >
        <AttachIcon />
        <span>{attachLabel}</span>
      </button>

      {isUploading && <span className="attachment-status">{uploadingLabel}</span>}
    </div>
  )
}
