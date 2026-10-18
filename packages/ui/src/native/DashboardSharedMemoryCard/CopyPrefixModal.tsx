import { useTranslation } from 'react-i18next'
import React, { useEffect, useState } from 'react'
import { Text, View } from 'react-native'
import { useNativeTheme } from '../../native/theme'
import { Input } from '../Input/Input'
import { Button } from '../Button'
import { Modal, modalActionsStyle } from '../Modal/Modal'
import { mobileTypography, sharedTokens } from '../../theme/tokens'

export function CopyPrefixModal({
  visible,
  initialValue,
  onCancel,
  onConfirm
}: {
  visible: boolean
  initialValue: string
  onCancel: () => void
  onConfirm: (value: string) => void
}) {
  const { t } = useTranslation()
  const { colors, tokens } = useNativeTheme()
  const [value, setValue] = useState(initialValue)

  useEffect(() => {
    if (visible) setValue(initialValue)
  }, [visible, initialValue])

  return (
    <Modal visible={visible} title={t('summary.copy_prefix_label', '拷贝前缀')} onClose={onCancel}>
      <Text
        style={{
          fontSize: mobileTypography.secondary.fontSize,
          lineHeight: 20,
          color: colors.textSecondary,
          marginBottom: tokens.spacing.mdTight
        }}
      >
        {t('summary.copy_prefix_hint', '会自动附加在拷贝内容的最前方（例如：Hi，这是我的回忆...）')}
      </Text>
      <Input
        value={value}
        onChangeText={setValue}
        multiline
        textarea
        autoFocus
        containerStyle={{ marginBottom: sharedTokens.spacing.md }}
        style={{ minHeight: 100 }}
      />
      <View style={modalActionsStyle}>
        <Button size="sm" variant="outlined" onPress={onCancel}>
          {t('common.cancel', '取消')}
        </Button>
        <Button size="sm" onPress={() => onConfirm(value)}>
          {t('common.confirm', '确定')}
        </Button>
      </View>
    </Modal>
  )
}
