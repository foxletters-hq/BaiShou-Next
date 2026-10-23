import { StyleSheet } from 'react-native'
import { mobileTypography, sharedTokens } from '../../theme/tokens'

/** 与 SettingsScreen 枢纽列表行一致的尺寸 */
export const settingsHubListStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: sharedTokens.spacing.mdSnug,
    paddingVertical: sharedTokens.spacing.mdSnug,
    gap: sharedTokens.spacing.mdTight
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: sharedTokens.radius.sm,
    alignItems: 'center',
    justifyContent: 'center'
  },
  title: {
    flex: 1,
    fontSize: mobileTypography.primary.fontSize,
    fontWeight: '500'
  },
  /** 展开行标题（不含 flex，避免嵌套布局影响字号） */
  rowTitle: {
    fontSize: mobileTypography.primary.fontSize,
    fontWeight: '500'
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth
  },
  /** 与 SettingsScreen 列表行右侧 › 一致 */
  hubChevron: {
    fontSize: mobileTypography.title.fontSize,
    lineHeight: 20
  }
})
