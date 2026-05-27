import { StyleSheet } from 'react-native'

export const cloudSyncPanelStyles = StyleSheet.create({
  container: {
    padding: 16,
    borderWidth: 1
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16
  },
  targetRow: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 8
  },
  targetChip: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1
  },
  targetChipText: {
    fontSize: 14,
    fontWeight: '500'
  },
  configSection: {
    marginBottom: 8
  },
  fieldGroup: {
    marginBottom: 12
  },
  fieldLabel: {
    fontSize: 13,
    marginBottom: 4
  },
  fieldInput: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    fontSize: 14
  },
  hintText: {
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 16
  },
  saveButton: {
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 12
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: '600'
  },
  syncButton: {
    flexDirection: 'row',
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginBottom: 16
  },
  syncButtonText: {
    fontSize: 15,
    fontWeight: '600'
  },
  recordsSection: {
    marginTop: 4
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 10
  },
  recordItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1
  },
  recordInfo: {
    flex: 1
  },
  recordName: {
    fontSize: 14
  },
  recordMeta: {
    fontSize: 11,
    marginTop: 2
  }
})
