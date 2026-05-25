import React, { useState, useEffect } from 'react'
import { AttachmentManagementView } from '@baishou/ui'

export const AttachmentManagementPane: React.FC = () => {
  const [attachments, setAttachments] = useState<any[]>([])

  const fetchData = async () => {
    try {
      const att = await (window as any).api?.attachment?.listAll()
      if (att) setAttachments(att)
    } catch (e) {}
  }

  useEffect(() => {
    fetchData()
  }, [])

  return (
    <div className="settings-pane settings-pane-full">
      <AttachmentManagementView
        attachments={attachments}
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
      />
    </div>
  )
}
