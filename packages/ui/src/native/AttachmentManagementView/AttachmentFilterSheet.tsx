import React from 'react'
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Pressable
} from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'

export type AttachmentFilterMode = 'year' | 'month' | 'orphan'

interface AttachmentFilterSheetProps {
  visible: boolean
  mode: AttachmentFilterMode
  availableYears: string[]
  diaryYear: string
  diaryMonth: string
  diaryOrphanOnly: boolean
  onClose: () => void
  onSelectYear: (year: string) => void
  onSelectMonth: (month: string) => void
  onSelectOrphanOnly: (orphanOnly: boolean) => void
}

export const AttachmentFilterSheet: React.FC<AttachmentFilterSheetProps> = ({
  visible,
  mode,
  availableYears,
  diaryYear,
  diaryMonth,
  diaryOrphanOnly,
  onClose,
  onSelectYear,
  onSelectMonth,
  onSelectOrphanOnly
}) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()

  const title =
    mode === 'year'
      ? t('gallery.filter_all_years', '选择年份')
      : mode === 'month'
        ? t('settings.all_months', '选择月份')
        : t('settings.all_filters', '筛选条件')

  const renderOptions = () => {
    if (mode === 'year') {
      return (
        <>
          <FilterOption
            label={t('gallery.filter_all_years', '全部年份')}
            active={diaryYear === 'all'}
            onPress={() => {
              onSelectYear('all')
              onClose()
            }}
            colors={colors}
          />
          {availableYears.map((year) => (
            <FilterOption
              key={year}
              label={`${year}${t('common.year_suffix', '年')}`}
              active={diaryYear === year}
              onPress={() => {
                onSelectYear(year)
                onClose()
              }}
              colors={colors}
            />
          ))}
        </>
      )
    }

    if (mode === 'month') {
      return (
        <>
          <FilterOption
            label={t('settings.all_months', '全部月份')}
            active={diaryMonth === 'all'}
            onPress={() => {
              onSelectMonth('all')
              onClose()
            }}
            colors={colors}
          />
          {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map((m) => (
            <FilterOption
              key={m}
              label={`${m}${t('common.month_suffix', '月')}`}
              active={diaryMonth === m}
              onPress={() => {
                onSelectMonth(m)
                onClose()
              }}
              colors={colors}
            />
          ))}
        </>
      )
    }

    return (
      <>
        <FilterOption
          label={t('settings.all_filters', '全部筛选')}
          active={!diaryOrphanOnly}
          onPress={() => {
            onSelectOrphanOnly(false)
            onClose()
          }}
          colors={colors}
        />
        <FilterOption
          label={t('settings.tag_orphan', '孤立附件')}
          active={diaryOrphanOnly}
          onPress={() => {
            onSelectOrphanOnly(true)
            onClose()
          }}
          colors={colors}
        />
      </>
    )
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={sheetStyles.overlay} onPress={onClose}>
        <Pressable
          style={[sheetStyles.sheet, { backgroundColor: colors.bgSurface }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={[sheetStyles.header, { borderBottomColor: colors.borderSubtle }]}>
            <Text style={[sheetStyles.title, { color: colors.textPrimary }]}>{title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <MaterialIcons name="close" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <ScrollView style={sheetStyles.list}>{renderOptions()}</ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const FilterOption: React.FC<{
  label: string
  active: boolean
  onPress: () => void
  colors: ReturnType<typeof useNativeTheme>['colors']
}> = ({ label, active, onPress, colors }) => (
  <TouchableOpacity
    style={[sheetStyles.option, active && { backgroundColor: colors.primary + '18' }]}
    onPress={onPress}
  >
    <Text
      style={{
        color: active ? colors.primary : colors.textPrimary,
        fontSize: 15,
        fontWeight: active ? '700' : '400'
      }}
    >
      {label}
    </Text>
    {active && <MaterialIcons name="check" size={18} color={colors.primary} />}
  </TouchableOpacity>
)

const sheetStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end'
  },
  sheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '70%'
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1
  },
  title: {
    fontSize: 16,
    fontWeight: '700'
  },
  list: {
    paddingVertical: 8
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14
  }
})
