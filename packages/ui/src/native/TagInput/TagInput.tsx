import React, { useState, useRef } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'
import { Input } from '../Input/Input'
import { mobileTypography, sharedTokens } from '../../theme/tokens'

export interface TagInputProps {
  tags: string[]
  onChange: (tags: string[]) => void
  placeholder?: string
  maxTags?: number
}

export const TagInput: React.FC<TagInputProps> = ({
  tags,
  onChange,
  placeholder,
  maxTags = 20
}) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const [inputText, setInputText] = useState('')
  const inputRef = useRef<any>(null)

  const addTag = (text: string) => {
    const trimmed = text.trim()
    if (!trimmed) return
    if (tags.includes(trimmed)) {
      setInputText('')
      return
    }
    if (tags.length >= maxTags) return
    onChange([...tags, trimmed])
    setInputText('')
  }

  const removeTag = (index: number) => {
    const newTags = tags.filter((_, i) => i !== index)
    onChange(newTags)
  }

  const handleSubmit = () => {
    addTag(inputText)
  }

  const handleKeyPress = (key: string) => {
    if (key === 'Enter') {
      addTag(inputText)
    }
  }

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.bgSurface,
          borderColor: colors.borderControl
        }
      ]}
    >
      <View style={styles.tagsRow}>
        {tags.map((tag, index) => (
          <View
            key={`${tag}-${index}`}
            style={[styles.tag, { backgroundColor: colors.primaryLight }]}
          >
            <Text style={[styles.tagText, { color: colors.primary }]}>{tag}</Text>
            <Pressable onPress={() => removeTag(index)} style={styles.tagRemove} hitSlop={8}>
              <Text style={[styles.tagRemoveText, { color: colors.primary }]}>×</Text>
            </Pressable>
          </View>
        ))}
      </View>

      {tags.length < maxTags && (
        <Input
          ref={inputRef}
          value={inputText}
          onChangeText={setInputText}
          onSubmitEditing={handleSubmit}
          onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key)}
          placeholder={placeholder ?? t('diary.tag_input_hint', '使用换行添加标签哦...')}
          style={styles.input}
          returnKeyType="done"
          blurOnSubmit={false}
        />
      )}

      {tags.length >= maxTags && (
        <Text style={[styles.limitHint, { color: colors.textTertiary }]}>
          {t('tagInput.limitReached', '已达到标签数量上限')}
        </Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    borderRadius: sharedTokens.radius.md,
    borderWidth: 1,
    padding: sharedTokens.spacing.smPlus,
    minHeight: 48
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: sharedTokens.spacing.xsPlus,
    marginBottom: sharedTokens.spacing.xsPlus
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: sharedTokens.spacing.smPlus,
    paddingVertical: sharedTokens.spacing.xs,
    borderRadius: sharedTokens.radius.lg
  },
  tagText: {
    fontSize: mobileTypography.secondary.fontSize,
    marginRight: sharedTokens.spacing.xs
  },
  tagRemove: {
    width: 18,
    height: 18,
    borderRadius: sharedTokens.radius.sm,
    alignItems: 'center',
    justifyContent: 'center'
  },
  tagRemoveText: {
    fontSize: mobileTypography.primary.fontSize,
    lineHeight: 18,
    fontWeight: '600'
  },
  input: {
    fontSize: mobileTypography.body.fontSize,
    paddingVertical: sharedTokens.spacing.xs,
    minWidth: 60
  },
  limitHint: {
    fontSize: mobileTypography.caption.fontSize,
    marginTop: sharedTokens.spacing.xs
  }
})
