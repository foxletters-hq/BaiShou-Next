import React, { useState } from 'react'
import { View, Text, Pressable, StyleSheet, Modal } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Gauge } from 'lucide-react-native'
import { useNativeTheme } from '@baishou/ui/native'
import { mobileTypography, sharedTokens } from '@baishou/ui/theme/tokens'

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
        <Gauge size={14} color={colors.primary} strokeWidth={2} />
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
    gap: sharedTokens.spacing.xsPlus,
    paddingHorizontal: sharedTokens.spacing.mdTight,
    paddingVertical: sharedTokens.spacing.xs,
    borderRadius: sharedTokens.radius.full
  },
  triggerText: {
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: '600'
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    padding: sharedTokens.spacing.xl
  },
  menu: {
    borderRadius: sharedTokens.radius.md,
    overflow: 'hidden'
  },
  option: {
    paddingHorizontal: sharedTokens.spacing.md,
    paddingVertical: sharedTokens.spacing.mdSnug
  }
})
