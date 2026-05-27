import { StyleSheet } from 'react-native'

export const appearanceSettingsStyles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 16,
    marginBottom: 16,
    marginHorizontal: 16,
    overflow: 'hidden'
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16
  },
  icon: { fontSize: 24, marginRight: 16 },
  headerBody: { flex: 1 },
  title: { fontSize: 16, fontWeight: '500' },
  subtitle: { fontSize: 14, marginTop: 4 },
  arrow: { fontSize: 12 },
  content: { paddingHorizontal: 16, paddingBottom: 16 },
  label: { fontSize: 14, fontWeight: '500', marginBottom: 8 },
  segmentedControl: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 20,
    overflow: 'hidden'
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRightWidth: 1
  },
  segmentText: { fontSize: 14 },
  colorWrap: { flexDirection: 'row', gap: 12 },
  colorOption: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center'
  },
  checkIcon: { fontSize: 20 },
  customColorBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1
  },
  addIcon: { fontSize: 20 },
  divider: { height: 1, marginVertical: 16 },
  langWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  langChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1
  },
  langText: { fontSize: 14 },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  modalBox: {
    width: '85%',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center'
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20
  },
  colorPreview: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginBottom: 20,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8
  },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: 12
  },
  sliderLabel: {
    width: 40,
    fontSize: 14,
    fontWeight: 'bold'
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    width: '100%',
    marginTop: 24,
    gap: 12
  },
  modalBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center'
  },
  modalBtnTextGray: { fontWeight: 'bold' },
  modalBtnTextWhite: { fontWeight: 'bold' }
})
