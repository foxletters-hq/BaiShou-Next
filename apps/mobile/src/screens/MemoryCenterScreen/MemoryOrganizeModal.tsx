import React from 'react'
import { Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Button, Modal, useNativeTheme } from '@baishou/ui/native'
import type { RagState } from '@baishou/ui/native'

export function MemoryOrganizeModal(props: {
  visible: boolean
  ragState: RagState
  onClose: () => void
  onPause: () => void
  onResume: () => void
  onCancel: () => void
}) {
  const { t } = useTranslation()
  const { colors, tokens } = useNativeTheme()
  const running = props.ragState.isRunning && props.ragState.type === 'batchEmbed'
  return (
    <Modal
      visible={props.visible}
      title={
        running
          ? t('memory.readiness_organizing', '正在整理记忆…')
          : t('memory.organize_done', '整理完毕')
      }
      onClose={props.onClose}
    >
      {running ? (
        <>
          <Text style={{ color: colors.textSecondary, marginBottom: tokens.spacing.md }}>
            {props.ragState.statusText || t('memory.readiness_organizing', '正在整理记忆…')}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing.sm }}>
            <Button variant="outlined" onPress={props.ragState.paused ? props.onResume : props.onPause}>
              {props.ragState.paused
                ? t('settings.rag_batch_embed_resume', '继续')
                : t('settings.rag_batch_embed_pause', '暂停')}
            </Button>
            <Button variant="outlined" onPress={props.onCancel}>
              {t('settings.rag_batch_embed_cancel', '取消')}
            </Button>
          </View>
        </>
      ) : (
        <View style={{ flexDirection: 'row' }}>
          <Button onPress={props.onClose}>{t('common.got_it', '知道了')}</Button>
        </View>
      )}
    </Modal>
  )
}
