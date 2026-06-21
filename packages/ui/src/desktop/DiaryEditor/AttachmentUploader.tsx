import React from 'react'
import { useAttachmentUploader } from './useAttachmentUploader'
import { AttachmentUploaderToolbar } from './AttachmentUploaderToolbar'
import { AttachmentUploaderList } from './AttachmentUploaderList'
import type { AttachmentUploaderProps } from './attachment-uploader.types'
import './AttachmentUploader.css'

// Integration tests: image/*, video/*, audio/*, handlePaste, clipboardData,
// openAttachmentFolder, copyAttachment — see useAttachmentUploader.ts
export type { DiaryAttachmentItem } from './attachment-uploader.types'
export { getInsertMarkdown } from './attachment-uploader.utils'

export const AttachmentUploader: React.FC<AttachmentUploaderProps> = (props) => {
  const vm = useAttachmentUploader(props)

  return (
    <div
      className={`attachment-uploader ${vm.isDragging ? 'dragging' : ''}`}
      onDragOver={vm.handleDragOver}
      onDragLeave={vm.handleDragLeave}
      onDrop={vm.handleDrop}
      onPaste={vm.handlePaste}
    >
      <input
        ref={vm.fileInputRef}
        type="file"
        multiple
        accept="image/*,video/*,audio/*"
        style={{ display: 'none' }}
        onChange={(e) => vm.handleFileSelect(e.target.files)}
      />

      <AttachmentUploaderToolbar
        isUploading={vm.isUploading}
        onPickFiles={() => vm.fileInputRef.current?.click()}
        uploadLabel={vm.t('diary.attachment.upload', '上传附件')}
        attachLabel={vm.t('diary.attachment.attach', '附件')}
        uploadingLabel={vm.t('diary.attachment.uploading', '上传中...')}
      />

      <AttachmentUploaderList
        attachments={props.attachments}
        getContextMenuItems={vm.getContextMenuItems}
        onInsertAttachment={vm.onInsertAttachment}
        onCopy={vm.handleCopyAttachment}
        onOpenFolder={vm.handleOpenFolder}
        onDelete={vm.handleDeleteAttachment}
        insertTitle={vm.t('diary.attachment.insert', '插入到编辑器')}
        copyTitle={vm.t('diary.attachment.copy', '复制')}
        openFolderTitle={vm.t('diary.attachment.open_folder', '打开文件夹')}
        deleteTitle={vm.t('diary.attachment.delete', '删除')}
      />
    </div>
  )
}
