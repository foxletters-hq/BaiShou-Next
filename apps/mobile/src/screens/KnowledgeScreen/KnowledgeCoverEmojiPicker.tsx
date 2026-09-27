import React, { useMemo, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { listNotebookCoverEmojis } from '@baishou/shared'
import { settingsTypography } from '@baishou/ui/theme/tokens'
import { Input, useNativeTheme } from '@baishou/ui/native'
import { knowledgeDetailStyles as styles } from './knowledge-detail.styles'

export function KnowledgeCoverEmojiPicker(props: {
  selected: string
  disabled?: boolean
  onSelect: (icon: string) => void
}) {
  const { t } = useTranslation()
  const { colors, tokens } = useNativeTheme()
  const [query, setQuery] = useState('')
  const emojis = useMemo(() => listNotebookCoverEmojis(query), [query])
  const iconSize = tokens.spacing.xl + tokens.spacing.xs

  return (
    <View style={{ gap: tokens.spacing.sm }}>
      <Input
        value={query}
        onChangeText={setQuery}
        placeholder={t('knowledge.cover_emoji_search', '搜索图标')}
      />
      <View style={[styles.chipWrap, { gap: tokens.spacing.sm }]}>
        {emojis.map((icon) => (
          <Pressable
            key={icon}
            disabled={props.disabled}
            onPress={() => props.onSelect(icon)}
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
    </View>
  )
}
