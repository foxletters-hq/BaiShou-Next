import React from 'react'
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Pressable,
  ScrollView
} from 'react-native'
import Slider from '@react-native-community/slider'
import { MaterialIcons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { Input } from '@baishou/ui/native'
import type { useNativeTheme } from '@baishou/ui/native'

type ThemeColors = ReturnType<typeof useNativeTheme>['colors']

const COUNT_CHIPS = [1, 2, 3, 5, 10, 15, -1] as const

export interface DataSyncCountModalProps {
  visible: boolean
  activeTab: 'cloud' | 'snapshot'
  tempCount: number
  noLimitLabel: string
  colors: ThemeColors
  maxModalWidth: number
  onChangeCount: (count: number) => void
  onConfirm: () => void
  onClose: () => void
}

export const DataSyncCountModal: React.FC<DataSyncCountModalProps> = ({
  visible,
  activeTab,
  tempCount,
  noLimitLabel,
  colors,
  maxModalWidth,
  onChangeCount,
  onConfirm,
  onClose
}) => {
  const { t } = useTranslation()
  const isSnapshot = activeTab === 'snapshot'

  const displayValue = tempCount === -1 ? noLimitLabel : String(tempCount)

  const handleInputChange = (text: string) => {
    const val = text.trim()
    if (
      val === '' ||
      val === noLimitLabel ||
      val === t('data_sync.no_limit', '不限制数量') ||
      val === '不限制' ||
      val === '∞' ||
      val === '-1'
    ) {
      onChangeCount(-1)
      return
    }
    const num = parseInt(val, 10)
    if (!Number.isNaN(num)) {
      onChangeCount(Math.min(100, Math.max(1, num)))
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable
          style={[
            styles.sheet,
            {
              backgroundColor: colors.bgSurface,
              borderColor: colors.borderSubtle,
              maxWidth: maxModalWidth,
              alignSelf: 'center',
              width: '92%'
            }
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.header}>
            <MaterialIcons name="inventory-2" size={22} color={colors.primary} />
            <Text style={[styles.title, { color: colors.textPrimary }]}>
              {isSnapshot
                ? t('data_sync.max_snapshot_title', '快照上限设置')
                : t('data_sync.max_backup_title', '备份上限设置')}
            </Text>
            <Input
              value={displayValue}
              onChangeText={handleInputChange}
              onBlur={() => {
                if (tempCount !== -1) {
                  onChangeCount(Math.min(100, Math.max(1, tempCount)))
                }
              }}
              keyboardType="number-pad"
            />
          </View>

          <Text style={[styles.desc, { color: colors.textSecondary }]}>
            {isSnapshot
              ? t(
                  'data_sync.max_snapshot_desc',
                  '超过上限后，自动生成新快照时将清理最早的历史快照。'
                )
              : t('data_sync.max_backup_desc', '超过上限后，同步备份时将自动删除最早的备份文件。')}
          </Text>

          <Slider
            style={styles.slider}
            minimumValue={1}
            maximumValue={50}
            step={1}
            value={tempCount === -1 ? 50 : tempCount}
            onValueChange={(v) => onChangeCount(Math.round(v))}
            minimumTrackTintColor={colors.primary}
            maximumTrackTintColor={colors.borderSubtle}
            thumbTintColor={colors.primary}
          />

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsRow}>
            {COUNT_CHIPS.map((val) => {
              const active = tempCount === val
              return (
                <TouchableOpacity
                  key={val}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: active ? colors.primary : colors.bgSurfaceNormal,
                      borderColor: active ? colors.primary : colors.borderSubtle
                    }
                  ]}
                  onPress={() => onChangeCount(val)}
                >
                  <Text
                    style={{
                      color: active ? colors.textOnPrimary : colors.textSecondary,
                      fontSize: 12,
                      fontWeight: '500'
                    }}
                  >
                    {val === -1
                      ? t('data_sync.no_limit', '不限制数量')
                      : t('data_sync.count_unit_value', '$count 个').replace('$count', String(val))}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.footerBtn, { borderColor: colors.borderSubtle }]}
              onPress={onClose}
            >
              <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>
                {t('common.cancel')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.footerBtn,
                { backgroundColor: colors.primary, borderColor: colors.primary }
              ]}
              onPress={onConfirm}
            >
              <Text style={{ color: colors.textOnPrimary, fontWeight: '700' }}>
                {t('common.confirm')}
              </Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 16
  },
  sheet: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12
  },
  title: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700'
  },
  desc: {
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 8
  },
  slider: {
    width: '100%',
    height: 40,
    marginVertical: 8
  },
  chipsRow: {
    marginTop: 8,
    marginBottom: 16
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    marginRight: 8
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10
  },
  footerBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1
  }
})
