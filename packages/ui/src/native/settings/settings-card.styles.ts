import { StyleSheet } from 'react-native'

export const settingsCardStyles = StyleSheet.create({
  cardTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  cardDesc: { fontSize: 14, lineHeight: 20, marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600' },
  hint: { fontSize: 12, marginTop: 2, lineHeight: 17 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowText: { flex: 1 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8, marginBottom: 4 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  collapsed: {
    height: 0,
    overflow: 'hidden',
    opacity: 0
  }
})
