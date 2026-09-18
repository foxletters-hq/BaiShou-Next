import { useCallback, useRef, useState } from 'react'
import { Keyboard } from 'react-native'
import { useTranslation } from 'react-i18next'
import type {
  DiaryCmTableSheetRequestPayload,
  DiaryCmTableSheetResponsePayload
} from '../../shared/diary-codemirror/types'
import { confirmMessageForDestructiveItem } from '../../shared/diary-codemirror/table/tableConfirm'
import { useDialog } from '../Dialog/Dialog'

export type ActiveTableSheet = DiaryCmTableSheetRequestPayload & {
  respond: (response: DiaryCmTableSheetResponsePayload) => void
}

export function useDiaryEditorTableSheet(keyboardInsetLockedRef: React.MutableRefObject<boolean>) {
  const { t } = useTranslation()
  const dialog = useDialog()
  const [tableSheet, setTableSheet] = useState<ActiveTableSheet | null>(null)
  const tableSheetRef = useRef<ActiveTableSheet | null>(null)
  tableSheetRef.current = tableSheet

  const handleTableSheetRequest = useCallback(
    (
      payload: DiaryCmTableSheetRequestPayload,
      respond: (response: DiaryCmTableSheetResponsePayload) => void
    ) => {
      Keyboard.dismiss()
      keyboardInsetLockedRef.current = true
      setTableSheet((prev) => {
        if (prev) {
          prev.respond({ requestId: prev.requestId, action: 'dismiss' })
        }
        return { ...payload, respond }
      })
    },
    [keyboardInsetLockedRef]
  )

  const closeTableSheet = useCallback(() => {
    setTableSheet((current) => {
      if (current) {
        current.respond({ requestId: current.requestId, action: 'dismiss' })
      }
      keyboardInsetLockedRef.current = false
      return null
    })
  }, [keyboardInsetLockedRef])

  const handleTableSheetPick = useCallback(
    async (itemId: string) => {
      const sheet = tableSheetRef.current
      if (!sheet) return
      const item = sheet.sections.flatMap((section) => section.items).find((i) => i.id === itemId)
      if (item?.destructive) {
        const confirmed = await dialog.confirm(confirmMessageForDestructiveItem(item), {
          title: t('common.confirm_delete', '确认删除'),
          confirmText: t('common.delete', '删除'),
          cancelText: t('common.cancel', '取消'),
          destructive: true
        })
        if (!confirmed) return
      }
      const { requestId, respond } = sheet
      keyboardInsetLockedRef.current = false
      setTableSheet(null)
      respond({ requestId, action: 'pick', itemId })
    },
    [dialog, keyboardInsetLockedRef, t]
  )

  return {
    tableSheet,
    handleTableSheetRequest,
    closeTableSheet,
    handleTableSheetPick
  }
}
