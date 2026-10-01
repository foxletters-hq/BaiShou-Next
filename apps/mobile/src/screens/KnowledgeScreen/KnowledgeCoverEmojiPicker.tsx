import React, { useMemo, useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { listNotebookCoverEmojis } from '@baishou/shared'
import { settingsTypography } from '@baishou/ui/theme/tokens'
import { Button, Input, Modal, useNativeTheme } from '@baishou/ui/native'
import { knowledgeDetailStyles as styles } from './knowledge-detail.styles'

export function KnowledgeCoverEmojiPicker(props: {
  selected: string
  disabled?: boolean
  onSelect: (icon: string) => void
}) {
  const { t } = useTranslation()
  const { colors, tokens, screenHeight } = useNativeTheme()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const emojis = useMemo(() => listNotebookCoverEmojis(query), [query])
  const iconSize = tokens.spacing.xl + tokens.spacing.xs
  const pickLabel = t('knowledge.pick_cover_icon', '选择图标')

  const close = () => {
    setOpen(false)
    setQuery('')
  }

  return (
    <>
      <Button
        isDisabled={props.disabled}
        onPress={() => setOpen(true)}
        accessibilityLabel={pickLabel}
      >
        {props.selected ? `${props.selected} ${pickLabel}` : pickLabel}
      </Button>
      <Modal visible={open} title={pickLabel} onClose={close}>
        <View style={{ gap: tokens.spacing.sm }}>
          <Input
            value={query}
            onChangeText={setQuery}
            placeholder={t('knowledge.cover_icon_search', '搜索图标')}
          />
          <ScrollView
            keyboardShouldPersistTaps="handled"
            style={{ maxHeight: Math.round(screenHeight * 0.4) }}
          >
            <View style={[styles.chipWrap, { gap: tokens.spacing.sm }]}>
              {emojis.map((icon) => (
                <Pressable
                  key={icon}
                  onPress={() => {
                    props.onSelect(icon)
                    close()
                  }}
                  accessibilityLabel={icon}
                  style={{
                    width: iconSize,
                    height: iconSize,
                    borderRadius: tokens.radius.sm,
                    borderWidth: 1,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderColor: props.selected === icon ? colors.primary : colors.borderMuted,
                    backgroundColor: colors.bgSurface
                  }}
                >
                  <Text style={{ fontSize: settingsTypography.row.fontSize }}>{icon}</Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        </View>
      </Modal>
    </>
  )
}
