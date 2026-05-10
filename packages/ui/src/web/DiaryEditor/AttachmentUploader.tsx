import React, { useState, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ContextMenu, ContextMenuItem } from '../ContextMenu';
import './AttachmentUploader.css';

export interface DiaryAttachmentItem {
  id: string;
  fileName: string;
  filePath: string;
  relativePath: string;
  isImage: boolean;
  isVideo: boolean;
  isAudio: boolean;
  size?: number;
  previewUrl?: string;
}

interface AttachmentUploaderProps {
  date: Date;
  attachments: DiaryAttachmentItem[];
  onAttachmentsChange: (attachments: DiaryAttachmentItem[]) => void;
  onInsertAttachment: (attachment: DiaryAttachmentItem) => void;
}

export const AttachmentUploader: React.FC<AttachmentUploaderProps> = ({
  date,
  attachments,
  onAttachmentsChange,
  onInsertAttachment,
}) => {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileSelect = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setIsUploading(true);
    try {
      const attachmentInputs = Array.from(files).map(file => ({
        fileName: file.name,
        data: undefined as string | undefined,
        mimeType: file.type,
        // 在Electron中，我们需要获取文件路径
        filePath: (file as any).path || undefined,
      }));

      // 如果没有filePath（Web环境），使用base64
      const needsBase64 = attachmentInputs.some(a => !a.filePath);
      if (needsBase64) {
        for (let i = 0; i < files.length; i++) {
          const file = files[i]!;
          if (!attachmentInputs[i]!.filePath) {
            const base64 = await fileToBase64(file);
            attachmentInputs[i]!.data = base64;
          }
        }
      }

      const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      const results = await (window as any).api.diary.uploadAttachments({
        date: dateStr,
        attachments: attachmentInputs,
      });

      const newAttachments: DiaryAttachmentItem[] = results
        .filter((r: any) => r.success)
        .map((r: any) => ({
          id: Math.random().toString(36).substring(7),
          fileName: r.fileName,
          filePath: r.filePath,
          relativePath: r.relativePath,
          isImage: /\.(png|jpe?g|gif|webp|bmp)$/i.test(r.fileName),
          isVideo: /\.(mp4|webm|ogg|mov)$/i.test(r.fileName),
          isAudio: /\.(mp3|wav|ogg|aac)$/i.test(r.fileName),
        }));

      onAttachmentsChange([...attachments, ...newAttachments]);
    } catch (err) {
      console.error('Failed to upload attachments:', err);
    } finally {
      setIsUploading(false);
    }
  }, [date, attachments, onAttachmentsChange]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  }, [handleFileSelect]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    const files: File[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i]!;
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file) files.push(file);
      }
    }

    if (files.length > 0) {
      e.preventDefault();
      const fileList = new DataTransfer();
      files.forEach(f => fileList.items.add(f));
      handleFileSelect(fileList.files);
    }
  }, [handleFileSelect]);

  const handleDeleteAttachment = useCallback(async (attachment: DiaryAttachmentItem) => {
    try {
      await (window as any).api.diary.deleteAttachment(attachment.filePath);
      onAttachmentsChange(attachments.filter(a => a.id !== attachment.id));
    } catch (err) {
      console.error('Failed to delete attachment:', err);
    }
  }, [attachments, onAttachmentsChange]);

  const handleOpenFolder = useCallback(async (attachment: DiaryAttachmentItem) => {
    try {
      await (window as any).api.diary.openAttachmentFolder(attachment.filePath);
    } catch (err) {
      console.error('Failed to open folder:', err);
    }
  }, []);

  const handleCopyAttachment = useCallback(async (attachment: DiaryAttachmentItem) => {
    try {
      await (window as any).api.diary.copyAttachment(attachment.filePath);
    } catch (err) {
      console.error('Failed to copy attachment:', err);
    }
  }, []);

  const getContextMenuItems = useCallback((attachment: DiaryAttachmentItem): ContextMenuItem[] => [
    {
      label: t('diary.attachment.insert', '插入到编辑器'),
      icon: (
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="12" y1="5" x2="12" y2="19" />
          <polyline points="19 12 12 19 5 12" />
        </svg>
      ),
      onClick: () => onInsertAttachment(attachment),
    },
    {
      label: t('diary.attachment.copy', '复制'),
      icon: (
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      ),
      onClick: () => handleCopyAttachment(attachment),
    },
    {
      label: t('diary.attachment.open_folder', '打开文件夹'),
      icon: (
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
        </svg>
      ),
      onClick: () => handleOpenFolder(attachment),
    },
    { divider: true, label: '', onClick: () => {} },
    {
      label: t('diary.attachment.delete', '删除'),
      icon: (
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </svg>
      ),
      onClick: () => handleDeleteAttachment(attachment),
    },
  ], [t, onInsertAttachment, handleCopyAttachment, handleOpenFolder, handleDeleteAttachment]);

  return (
    <div
      className={`attachment-uploader ${isDragging ? 'dragging' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onPaste={handlePaste}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,video/*,audio/*"
        style={{ display: 'none' }}
        onChange={(e) => handleFileSelect(e.target.files)}
      />

      <div className="attachment-toolbar">
        <button
          className="attachment-btn"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          title={t('diary.attachment.upload', '上传附件')}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
          </svg>
          <span>{t('diary.attachment.attach', '附件')}</span>
        </button>

        {isUploading && (
          <span className="attachment-status">
            {t('diary.attachment.uploading', '上传中...')}
          </span>
        )}
      </div>

      {attachments.length > 0 && (
        <div className="attachment-list">
          {attachments.map((att) => (
            <ContextMenu key={att.id} items={getContextMenuItems(att)}>
              <div className="attachment-item">
                <div className="attachment-info">
                  {att.isImage && (
                    <span className="attachment-icon">🖼️</span>
                  )}
                  {att.isVideo && (
                    <span className="attachment-icon">🎬</span>
                  )}
                  {att.isAudio && (
                    <span className="attachment-icon">🎵</span>
                  )}
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
                    title={t('diary.attachment.insert', '插入到编辑器')}
                  >
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <polyline points="19 12 12 19 5 12" />
                    </svg>
                  </button>
                  <button
                    className="attachment-action-btn"
                    onClick={() => handleCopyAttachment(att)}
                    title={t('diary.attachment.copy', '复制')}
                  >
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                  </button>
                  <button
                    className="attachment-action-btn"
                    onClick={() => handleOpenFolder(att)}
                    title={t('diary.attachment.open_folder', '打开文件夹')}
                  >
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                    </svg>
                  </button>
                  <button
                    className="attachment-action-btn delete"
                    onClick={() => handleDeleteAttachment(att)}
                    title={t('diary.attachment.delete', '删除')}
                  >
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                </div>
              </div>
            </ContextMenu>
          ))}
        </div>
      )}
    </div>
  );
};

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
}
