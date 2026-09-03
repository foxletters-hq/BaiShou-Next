import React, { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { CircleHelp } from 'lucide-react-native'
import { GRAPH_EXTRACT_ALIGN_POOL_SIZE } from '@baishou/shared'
import { FloatingModal, HELP_ICON_SIZE, useNativeTheme } from '@baishou/ui/native'

export const GraphExtractHelpButton: React.FC<{ size?: number }> = ({ size: _size }) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const { width: screenWidth } = useWindowDimensions()
  const [open, setOpen] = useState(false)

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={t('graph.extract_help_aria', '抽取与抽取池说明')}
      >
        <CircleHelp
          size={HELP_ICON_SIZE}
          color={colors.textTertiary}
          strokeWidth={2}
          style={{ opacity: 0.8 }}
        />
      </Pressable>
      <FloatingModal
        visible={open}
        onClose={() => setOpen(false)}
        maxWidth={Math.min(screenWidth - 32, 440)}
      >
        <ScrollView
          style={{ maxHeight: 480 }}
          contentContainerStyle={styles.pad}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            {t('graph.extract_help_modal_title', '抽取与抽取池')}
          </Text>
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
              {t('graph.extract_help_extract_title', '抽取')}
            </Text>
            <Text style={[styles.body, { color: colors.textSecondary }]}>
              {t(
                'graph.extract_help_extract',
                '把日记交给模型，从文字里整理出人物、地点、事件和关系。这里的数字是同时有几篇日记在抽取。数字越大通常越快，也会同时占用更多模型调用。'
              )}
            </Text>
          </View>
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
              {t('graph.extract_help_pool_title', '抽取池')}
            </Text>
            <Text style={[styles.body, { color: colors.textSecondary }]}>
              {t(
                'graph.extract_help_pool',
                '单篇抽完不会立刻写入图谱。草稿先进入抽取池；攒满 {{pool}} 篇，或这一批都抽完了，再召回相似度大于 {{similarity}}% 的已有节点，由模型判断要不要合并，然后一起写入。这样相近的实体不容易拆成多个节点。',
                {
                  pool: GRAPH_EXTRACT_ALIGN_POOL_SIZE,
                  similarity: 50
                }
              )}
            </Text>
          </View>
          <Pressable onPress={() => setOpen(false)} style={styles.close}>
            <Text style={{ color: colors.primary, fontWeight: '700' }}>
              {t('common.close', '关闭')}
            </Text>
          </Pressable>
        </ScrollView>
      </FloatingModal>
    </>
  )
}

const styles = StyleSheet.create({
  pad: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
    gap: 16
  },
  title: {
    fontSize: 17,
    fontWeight: '700'
  },
  section: {
    gap: 6
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600'
  },
  body: {
    fontSize: 14,
    lineHeight: 21
  },
  close: {
    alignSelf: 'flex-end',
    marginTop: 4
  }
})
