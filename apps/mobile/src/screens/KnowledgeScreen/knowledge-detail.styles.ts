import { StyleSheet } from 'react-native'

export const knowledgeDetailStyles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  pad: { padding: 16 },
  coverRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  coverPreview: {
    width: 56,
    height: 56,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden'
  },
  coverImage: { width: 56, height: 56 },
  coverEmoji: { fontSize: 28 },
  h1: { fontSize: 22, fontWeight: '600', flex: 1 },
  section: { fontSize: 16, fontWeight: '600', marginBottom: 8, marginTop: 16 },
  mountHint: { fontSize: 13, lineHeight: 20, marginTop: 16, marginBottom: 8 },
  sourceCard: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8
  },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  sourceStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  banner: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    padding: 12,
    marginVertical: 12,
    gap: 8
  },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  toneChip: { width: 28, height: 28, borderRadius: 14, borderWidth: 2 },
  iconChip: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  rowGap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 8 }
})
