import { StyleSheet } from 'react-native'
import { mobileTypography, sharedTokens } from '../../theme/tokens'

/** 移动设置卡片共用字号，对齐 `--mobile-fs-*` / mobileTypography */
export const settingsCardStyles = StyleSheet.create({
  cardTitle: {
    fontSize: mobileTypography.title.fontSize,
    fontWeight: mobileTypography.title.fontWeight,
    marginBottom: sharedTokens.spacing.sm
  },
  cardDesc: {
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: mobileTypography.secondary.fontWeight,
    lineHeight: 20,
    marginBottom: sharedTokens.spacing.md
  },
  label: {
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: mobileTypography.secondary.fontWeight
  },
  hint: {
    fontSize: mobileTypography.caption.fontSize,
    fontWeight: mobileTypography.caption.fontWeight,
    marginTop: sharedTokens.spacing.xxs,
    lineHeight: 17
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: sharedTokens.spacing.mdTight },
  rowText: { flex: 1 },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: sharedTokens.spacing.sm,
    marginTop: sharedTokens.spacing.sm,
    marginBottom: sharedTokens.spacing.xs
  },
  chip: {
    paddingHorizontal: sharedTokens.spacing.mdSnug,
    paddingVertical: sharedTokens.spacing.sm,
    borderRadius: sharedTokens.radius.lgPlus,
    borderWidth: 1,
    flexGrow: 1,
    flexBasis: '30%',
    minWidth: 100,
    maxWidth: '48%',
    alignItems: 'center'
  },
  collapsed: {
    height: 0,
    overflow: 'hidden',
    opacity: 0
  }
})

/** 设置卡文字走系统默认字族，不指定 fontFamily。 */
export function useSettingsCardStyles() {
  return settingsCardStyles
}
