import { StyleSheet } from 'react-native'

/** 与 SettingsScreen 枢纽列表行一致的尺寸 */
export const settingsHubListStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 12
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center'
  },
  title: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500'
  },
  /** 展开行标题（不含 flex，避免嵌套布局影响字号） */
  rowTitle: {
    fontSize: 16,
    fontWeight: '500'
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth
  }
})
