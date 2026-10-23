import { StyleSheet } from 'react-native'
import { mobileTypography, settingsIcons, sharedTokens } from '../../theme/tokens'

export const agentSessionListStyles = StyleSheet.create({
  container: { flex: 1, position: 'relative' },
  searchBar: {
    margin: sharedTokens.spacing.mdTight
  },
  searchInput: { fontSize: mobileTypography.secondary.fontSize },
  clearIcon: { fontSize: settingsIcons.trailing, paddingHorizontal: sharedTokens.spacing.xsPlus },
  groupHeader: {
    paddingHorizontal: sharedTokens.spacing.md,
    paddingVertical: sharedTokens.spacing.sm
  },
  groupLabel: { fontSize: mobileTypography.secondary.fontSize, fontWeight: '600' },
  item: {
    paddingHorizontal: sharedTokens.spacing.md,
    paddingVertical: sharedTokens.spacing.mdSnug,
    borderBottomWidth: StyleSheet.hairlineWidth
  },
  itemContent: { flex: 1 },
  itemHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: sharedTokens.spacing.xs },
  pinIcon: { fontSize: mobileTypography.secondary.fontSize, marginRight: sharedTokens.spacing.xs },
  itemTitle: { fontSize: mobileTypography.primary.fontSize, flex: 1 },
  itemMeta: { flexDirection: 'row', justifyContent: 'space-between' },
  itemTime: { fontSize: mobileTypography.caption.fontSize },
  itemCount: { fontSize: mobileTypography.caption.fontSize },
  emptyContainer: { padding: sharedTokens.spacing.xlPlus, alignItems: 'center' },
  emptyText: { fontSize: mobileTypography.body.fontSize },
  footerLoader: { paddingVertical: sharedTokens.spacing.md, alignItems: 'center' }
})
