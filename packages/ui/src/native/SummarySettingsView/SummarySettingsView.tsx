import { useTranslation } from 'react-i18next'
import React, { useState } from 'react'
import { View, Text, StyleSheet, ScrollView, Modal } from 'react-native'
import { useNativeTheme } from '../theme'
import { SettingsSection } from '../SettingsSection'
import { Input } from '../Input/Input'
import { Button } from '../Button'

export interface SummarySettingsViewProps {
  config: {
    weeklyTemplate: string
    monthlyTemplate: string
    quarterlyTemplate: string
    yearlyTemplate: string
  }
  onChange: (config: {
    weeklyTemplate: string
    monthlyTemplate: string
    quarterlyTemplate: string
    yearlyTemplate: string
  }) => void
}

interface TemplateItem {
  key: keyof SummarySettingsViewProps['config']
  title: string
  icon: string
}

const TEMPLATES: TemplateItem[] = [
  { key: 'weeklyTemplate', title: '周结', icon: '📋' },
  { key: 'monthlyTemplate', title: '月结', icon: '📅' },
  { key: 'quarterlyTemplate', title: '季结', icon: '📊' },
  { key: 'yearlyTemplate', title: '年结', icon: '📈' }
]

export const SummarySettingsView: React.FC<SummarySettingsViewProps> = ({ config, onChange }) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const [editingKey, setEditingKey] = useState<keyof SummarySettingsViewProps['config'] | null>(
    null
  )
  const [editValue, setEditValue] = useState('')

  const openEditor = (key: keyof SummarySettingsViewProps['config']) => {
    setEditingKey(key)
    setEditValue(config[key])
  }

  const saveEditor = () => {
    if (editingKey) {
      onChange({ ...config, [editingKey]: editValue })
    }
    setEditingKey(null)
  }

  const editingTemplate = editingKey ? TEMPLATES.find((t) => t.key === editingKey) : null

  return (
    <ScrollView
      style={styles.scroll}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <SettingsSection title={t('summary.templates', 'AI 总结指令模板')}>
        {TEMPLATES.map((item) => {
          const preview = config[item.key]
          const previewText = preview.length > 80 ? preview.substring(0, 80) + '...' : preview

          return (
            <View
              key={item.key}
              style={[styles.templateCard, { borderBottomColor: colors.borderSubtle }]}
            >
              <View style={styles.templateHeader}>
                <Text style={styles.templateIcon}>{item.icon}</Text>
                <Text style={[styles.templateTitle, { color: colors.textPrimary }]}>
                  {item.title}
                </Text>
              </View>
              <Text style={[styles.preview, { color: colors.textSecondary }]} numberOfLines={2}>
                {previewText || t('summary.empty_template', '未设置模板')}
              </Text>
              <Button variant="outline" onPress={() => openEditor(item.key)} className="self-start">
                {t('common.edit', '编辑')}
              </Button>
            </View>
          )
        })}
      </SettingsSection>

      <Modal visible={editingKey !== null} transparent animationType="fade">
        <View style={[styles.modalOverlay, { backgroundColor: colors.bgOverlay }]}>
          <View style={[styles.modalBox, { backgroundColor: colors.bgSurface }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
              {editingTemplate
                ? `${editingTemplate.icon} ${t('summary.edit_template', '编辑')}${editingTemplate.title}${t('summary.template', '模板')}`
                : t('summary.edit_template_title', '编辑模板')}
            </Text>

            <Input
              style={styles.modalInput}
              value={editValue}
              onChangeText={setEditValue}
              multiline
              textarea
              numberOfLines={12}
            />

            <View style={styles.modalActions}>
              <Button variant="ghost" onPress={() => setEditingKey(null)}>
                {t('common.cancel', '取消')}
              </Button>
              <Button variant="primary" onPress={saveEditor}>
                {t('common.save', '保存')}
              </Button>
            </View>
          </View>
        </View>
      </Modal>

      <View style={styles.bottomSpacer} />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  templateCard: {
    padding: 16,
    borderBottomWidth: 1
  },
  templateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8
  },
  templateIcon: { fontSize: 20, marginRight: 8 },
  templateTitle: { fontSize: 16, fontWeight: '500' },
  preview: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 10
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  modalBox: {
    width: '90%',
    borderRadius: 24,
    padding: 24,
    maxHeight: '80%'
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16
  },
  modalInput: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    minHeight: 200,
    lineHeight: 20
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 20,
    gap: 12
  },
  bottomSpacer: { height: 40 }
})
