import React, { useState } from 'react'
import { View, Text, Pressable, StyleSheet, Modal } from 'react-native'
import { useTranslation } from 'react-i18next'
import { MaterialIcons } from '@expo/vector-icons'
import { useNativeTheme } from '@baishou/ui/native'

interface ConcurrencyDropdownProps {
  value: number
  onChange: (n: number) => void
  disabled: boolean
}

export const ConcurrencyDropdown: React.FC<ConcurrencyDropdownProps> = ({
  value,
  onChange,
  disabled
}) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const [open, setOpen] = useState(false)

  return (
    <>
      <Pressable
        style={[
          styles.trigger,
          { backgroundColor: colors.primaryLight, opacity: disabled ? 0.7 : 1 }
        ]}
        disabled={disabled}
        onPress={() => setOpen(true)}
      >
        <MaterialIcons name="speed" size={14} color={colors.primary} />
        <Text style={[styles.triggerText, { color: colors.primary }]}>
          {t('summary.concurrency')}: {value}
        </Text>
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setOpen(false)}>
          <View style={[styles.menu, { backgroundColor: colors.bgSurface }]}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Pressable
                key={n}
                style={[styles.option, n === value && { backgroundColor: colors.primaryLight }]}
                onPress={() => {
                  onChange(n)
                  setOpen(false)
                }}
              >
                <Text
                  style={{
                    color: n === value ? colors.primary : colors.textPrimary,
                    fontWeight: n === value ? '700' : '400'
                  }}
                >
                  {t('summary.concurrency')}: {n}
                </Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999
  },
  triggerText: {
    fontSize: 13,
    fontWeight: '700'
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    padding: 32
  },
  menu: {
    borderRadius: 12,
    overflow: 'hidden'
  },
  option: {
    paddingHorizontal: 16,
    paddingVertical: 14
  }
})
