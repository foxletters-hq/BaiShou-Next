import { Platform, StyleSheet } from 'react-native'
import { mobileTypography, sharedTokens } from '@baishou/ui/theme/tokens'

const compactFieldHeight = 34

/** 回忆中心关系图谱嵌入页：区块标题 / 主行 / 说明 三档，控件高度对齐向量片段搜索框。 */
export const graphScreenSectionStyles = StyleSheet.create({
  card: {
    marginHorizontal: sharedTokens.spacing.md,
    gap: sharedTokens.spacing.sm
  },
  title: {
    fontSize: mobileTypography.title.fontSize,
    fontWeight: mobileTypography.title.fontWeight
  },
  row: {
    fontSize: mobileTypography.primary.fontSize,
    fontWeight: mobileTypography.primary.fontWeight
  },
  hint: {
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: mobileTypography.secondary.fontWeight
  },
  meta: {
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: mobileTypography.secondary.fontWeight
  },
  error: {
    fontSize: mobileTypography.caption.fontSize,
    fontWeight: mobileTypography.caption.fontWeight
  },
  toolbar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: sharedTokens.spacing.sm
  },
  searchBox: {
    flex: 1,
    minWidth: 120,
    height: compactFieldHeight,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    borderRadius: sharedTokens.radius.sm,
    borderWidth: 1,
    paddingHorizontal: sharedTokens.spacing.smPlus,
    paddingVertical: 0
  },
  searchInputWrap: {
    flex: 1,
    minWidth: 0,
    backgroundColor: 'transparent',
    borderWidth: 0,
    padding: 0,
    margin: 0
  },
  androidSearchRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: sharedTokens.spacing.xsPlus
  },
  searchInput: {
    flex: 1,
    fontSize: mobileTypography.secondary.fontSize,
    lineHeight: 20,
    fontWeight: '400',
    paddingVertical: 0,
    paddingHorizontal: 0,
    minHeight: 0,
    height: 32,
    backgroundColor: 'transparent',
    ...(Platform.OS === 'android'
      ? { includeFontPadding: false, textAlignVertical: 'center' as const }
      : { paddingTop: 0, paddingBottom: 0 })
  },
  fieldControl: {
    height: compactFieldHeight,
    minHeight: compactFieldHeight,
    borderWidth: 1,
    borderRadius: sharedTokens.radius.sm,
    paddingHorizontal: sharedTokens.spacing.smPlus,
    paddingVertical: 0,
    justifyContent: 'center',
    alignItems: 'center'
  },
  fieldText: {
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: mobileTypography.secondary.fontWeight,
    paddingHorizontal: 0,
    paddingVertical: 0,
    minHeight: 0,
    height: 32,
    width: '100%',
    textAlignVertical: 'center',
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : {})
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  fieldActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sharedTokens.spacing.sm
  },
  fieldControlGrow: {
    flex: 1,
    minWidth: 0
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: sharedTokens.spacing.sm
  }
})
