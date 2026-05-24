import React, { useState, useRef } from 'react'
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'

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
  const inputRef = useRef<TextInput>(null)

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
    if (inputText.includes(',')) {
      const parts = inputText.split(',')
      let newTags = [...tags]
      for (const part of parts) {
        const trimmed = part.trim()
        if (trimmed && !newTags.includes(trimmed) && newTags.length < maxTags) {
          newTags.push(trimmed)
        }
      }
      onChange(newTags)
      setInputText('')
    } else {
      addTag(inputText)
    }
  }

  const handleKeyPress = (key: string) => {
    if (key === 'Enter' || key === ',') {
      addTag(inputText)
    }
    if (key === 'Backspace' && !inputText && tags.length > 0) {
      removeTag(tags.length - 1)
    }
  }

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.bgSurface,
          borderColor: colors.borderSubtle
        }
      ]}
    >
      <View style={styles.tagsRow}>
        {tags.map((tag, index) => (
          <View
            key={`${tag}-${index}`}
            style={[
              styles.tag,
              { backgroundColor: colors.primaryLight }
            ]}
          >
            <Text style={[styles.tagText, { color: colors.primary }]}>{tag}</Text>
            <Pressable
              onPress={() => removeTag(index)}
              style={styles.tagRemove}
              hitSlop={8}
            >
              <Text style={[styles.tagRemoveText, { color: colors.primary }]}>×</Text>
            </Pressable>
          </View>
        ))}
      </View>

      {tags.length < maxTags && (
        <TextInput
          ref={inputRef}
          value={inputText}
          onChangeText={setInputText}
          onSubmitEditing={handleSubmit}
          onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key)}
          placeholder={
            placeholder ?? t('tagInput.placeholder', '输入标签，回车或逗号分隔')
          }
          placeholderTextColor={colors.textTertiary}
          style={[styles.input, { color: colors.textPrimary }]}
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
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    minHeight: 48
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 6
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16
  },
  tagText: {
    fontSize: 14,
    marginRight: 4
  },
  tagRemove: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center'
  },
  tagRemoveText: {
    fontSize: 16,
    lineHeight: 18,
    fontWeight: '700'
  },
  input: {
    fontSize: 15,
    paddingVertical: 4,
    minWidth: 60
  },
  limitHint: {
    fontSize: 12,
    marginTop: 4
  }
})
