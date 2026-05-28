import React, { useState, useEffect } from 'react'
import { AttachmentManagementView } from '@baishou/ui'

export const AttachmentManagementPane: React.FC = () => {
  const [attachments, setAttachments] = useState<any[]>([])
  const [diaryAttachments, setDiaryAttachments] = useState<any[]>([])

  const fetchData = async () => {
    try {
      const att = await (window as any).api?.attachment?.listAll()
      if (att) setAttachments(att)
    } catch (e) {}
  }

  const fetchDiaryData = async () => {
    try {
      const att = await (window as any).api?.attachment?.listDiaryAttachments()
      if (att) setDiaryAttachments(att)
    } catch (e) {}
  }

  useEffect(() => {
    void fetchDiaryData()
    // 默认展示日记附件；会话列表较重，延后加载以免阻塞首屏
    let idleId: number | undefined
    let timeoutId: number | undefined
    if (typeof requestIdleCallback === 'function') {
      idleId = requestIdleCallback(() => void fetchData())
    } else {
      timeoutId = window.setTimeout(() => void fetchData(), 200)
    }
    return () => {
      if (idleId !== undefined) cancelIdleCallback(idleId)
      if (timeoutId !== undefined) clearTimeout(timeoutId)
    }
  }, [])

  return (
    <div className="settings-pane settings-pane-full">
      <AttachmentManagementView
        attachments={attachments}
        diaryAttachments={diaryAttachments}
        onDeleteSelected={async (ids) => {
          await (window as any).api?.attachment?.deleteBatch(ids)
          await fetchData()
        }}
        onDeleteFile={async (sessionId, fileName) => {
          await (window as any).api?.attachment?.deleteFile(sessionId, fileName)
          await fetchData()
        }}
        onOpenFileLocation={async (absolutePath) => {
          await (window as any).api?.attachment?.openInFolder(absolutePath)
        }}
        onDeleteDiaryAttachment={async (filePath) => {
          await (window as any).api?.attachment?.deleteDiaryAttachment(filePath)
          await fetchDiaryData()
        }}
      />
    </div>
  )
}
