import React from 'react'
import { View, Text, Pressable, Modal, ScrollView, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { MaterialIcons } from '@expo/vector-icons'
import { useNativeTheme } from '../theme'

interface GalleryYearPickerModalProps {
  isOpen: boolean
  selectedYear: string
  availableYears: string[]
  onClose: () => void
  onYearChange: (year: string) => void
}

export const GalleryYearPickerModal: React.FC<GalleryYearPickerModalProps> = ({
  isOpen,
  selectedYear,
  availableYears,
  onClose,
  onYearChange
}) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()

  return (
    <Modal visible={isOpen} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable
          style={[styles.content, { backgroundColor: colors.bgSurface }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={[styles.header, { borderBottomColor: colors.borderSubtle }]}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>
              {t('gallery.select_year')}
            </Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <MaterialIcons name="close" size={20} color={colors.textSecondary} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.body}>
            <Pressable
              style={[
                styles.allBtn,
                {
                  backgroundColor:
                    selectedYear === 'all' ? colors.primaryLight : colors.bgSurfaceHigh,
                  borderColor: selectedYear === 'all' ? colors.primary : colors.borderSubtle
                }
              ]}
              onPress={() => onYearChange('all')}
            >
              <Text
                style={{
                  color: selectedYear === 'all' ? colors.primary : colors.textPrimary,
                  fontWeight: selectedYear === 'all' ? '700' : '500'
                }}
              >
                {t('gallery.filter_all_years')}
              </Text>
            </Pressable>
            <View style={styles.grid}>
              {availableYears.map((year) => {
                const active = selectedYear === year
                return (
                  <Pressable
                    key={year}
                    style={[
                      styles.yearCell,
                      {
                        backgroundColor: active ? colors.primaryLight : colors.bgSurfaceNormal,
                        borderColor: active ? colors.primary : colors.borderSubtle
                      }
                    ]}
                    onPress={() => onYearChange(year)}
                  >
                    <Text
                      style={{
                        color: active ? colors.primary : colors.textPrimary,
                        fontWeight: active ? '700' : '500'
                      }}
                    >
                      {year}
                    </Text>
                  </Pressable>
                )
              })}
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    padding: 24
  },
  content: {
    borderRadius: 16,
    maxHeight: '70%',
    overflow: 'hidden'
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1
  },
  title: {
    fontSize: 16,
    fontWeight: '700'
  },
  body: {
    padding: 16,
    gap: 12
  },
  allBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center'
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  yearCell: {
    minWidth: '30%',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center'
  }
})
