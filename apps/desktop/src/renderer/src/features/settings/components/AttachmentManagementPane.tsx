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
    fetchData()
    fetchDiaryData()
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

