import React, { useState, useRef } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'
import { Input } from '../Input/Input'

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
          borderColor: colors.borderSubtle
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
