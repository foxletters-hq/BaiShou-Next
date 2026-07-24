import { StyleSheet } from 'react-native'
import { settingsTypography } from '../../theme/tokens'

/** 移动设置卡片共用字号，对齐 desktop `--settings-font-*` / settingsTypography */
export const settingsCardStyles = StyleSheet.create({
  cardTitle: {
    fontSize: settingsTypography.section.fontSize,
    fontWeight: settingsTypography.section.fontWeight,
    marginBottom: 8
  },
  cardDesc: {
    fontSize: settingsTypography.desc.fontSize,
    fontWeight: settingsTypography.desc.fontWeight,
    lineHeight: 20,
    marginBottom: 16
  },
  label: {
    fontSize: settingsTypography.label.fontSize,
    fontWeight: settingsTypography.label.fontWeight
  },
  hint: {
    fontSize: settingsTypography.meta.fontSize,
    fontWeight: settingsTypography.meta.fontWeight,
    marginTop: 2,
    lineHeight: 17
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowText: { flex: 1 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8, marginBottom: 4 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
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
