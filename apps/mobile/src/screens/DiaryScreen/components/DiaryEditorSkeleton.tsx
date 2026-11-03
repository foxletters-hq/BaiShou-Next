import React from 'react'
import { StyleSheet, View } from 'react-native'
import { useNativeTheme } from '@baishou/ui/native'
import { mobileControlTokens, sharedTokens } from '@baishou/ui/theme/tokens'

const TOOLBAR_BUTTON_COUNT = 8

export const DiaryEditorSkeleton: React.FC = () => {
  const { colors } = useNativeTheme()

  return (
    <View style={styles.root} accessibilityLabel="Loading">
      <View style={[styles.appBar, { borderBottomColor: colors.borderSubtle }]}>
        <View style={[styles.appBarBack, { backgroundColor: colors.bgSurfaceHighest }]} />
        <View style={styles.appBarCenter}>
          <View style={[styles.appBarTitle, { backgroundColor: colors.bgSurfaceHighest }]} />
        </View>
        <View style={[styles.appBarSave, { backgroundColor: colors.bgSurfaceHighest }]} />
      </View>

      <View style={[styles.metaBar, { borderBottomColor: colors.borderSubtle }]}>
        <View style={styles.metaPickers}>
          <View style={[styles.metaPickerItem, { backgroundColor: colors.bgSurfaceHighest }]} />
          <View style={[styles.metaPickerItem, { backgroundColor: colors.bgSurfaceHighest }]} />
          <View style={[styles.metaSquareBtn, { backgroundColor: colors.bgSurfaceHighest }]} />
        </View>
        <View style={[styles.metaSquareBtn, { backgroundColor: colors.bgSurfaceHighest }]} />
      </View>

      <View style={styles.editorBody}>
        <View style={[styles.tagPill, { backgroundColor: colors.bgSurfaceHighest }]} />
        <View
          style={[styles.line, styles.lineLong, { backgroundColor: colors.bgSurfaceHighest }]}
        />
        <View
          style={[styles.line, styles.lineFull, { backgroundColor: colors.bgSurfaceHighest }]}
        />
        <View
          style={[styles.line, styles.lineMedium, { backgroundColor: colors.bgSurfaceHighest }]}
        />
        <View style={[styles.imageBlock, { backgroundColor: colors.bgSurfaceHighest }]} />
        <View
          style={[styles.line, styles.lineLong, { backgroundColor: colors.bgSurfaceHighest }]}
        />
        <View
          style={[styles.line, styles.lineShort, { backgroundColor: colors.bgSurfaceHighest }]}
        />
      </View>

      <View style={[styles.toolbar, { borderTopColor: colors.borderSubtle }]}>
        {Array.from({ length: TOOLBAR_BUTTON_COUNT }).map((_, index) => (
          <View
            key={index}
            style={[styles.toolbarBtn, { backgroundColor: colors.bgSurfaceHighest }]}
          />
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1
  },
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: sharedTokens.spacing.mdTight,
    paddingTop: sharedTokens.spacing.sm,
    paddingBottom: sharedTokens.spacing.mdTight,
    borderBottomWidth: 1
  },
  appBarBack: {
    width: 40,
    height: 40,
    borderRadius: sharedTokens.radius.md
  },
  appBarCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 0
  },
  appBarTitle: {
    width: 160,
    height: 34,
    borderRadius: sharedTokens.radius.lgPlus
  },
  appBarSave: {
    width: 64,
    height: 34,
    borderRadius: sharedTokens.radius.lgPlus
  },
  metaBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: sharedTokens.spacing.md,
    paddingVertical: sharedTokens.spacing.smPlus,
    borderBottomWidth: 1
  },
  metaPickers: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sharedTokens.spacing.sm
  },
  metaPickerItem: {
    width: 78,
    height: mobileControlTokens.height,
    borderRadius: mobileControlTokens.radius
  },
  metaSquareBtn: {
    width: mobileControlTokens.height,
    height: mobileControlTokens.height,
    borderRadius: mobileControlTokens.radius
  },
  editorBody: {
    flex: 1,
    paddingHorizontal: sharedTokens.spacing.md,
    paddingTop: sharedTokens.spacing.md,
    gap: sharedTokens.spacing.mdTight
  },
  tagPill: {
    width: 84,
    height: 24,
    borderRadius: sharedTokens.radius.sm
  },
  line: {
    height: 16,
    borderRadius: sharedTokens.radius.sm
  },
  lineFull: {
    width: '95%'
  },
  lineLong: {
    width: '84%'
  },
  lineMedium: {
    width: '68%'
  },
  lineShort: {
    width: '46%'
  },
  imageBlock: {
    width: '100%',
    height: 108,
    borderRadius: sharedTokens.radius.md,
    marginVertical: sharedTokens.spacing.xs
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: sharedTokens.spacing.sm,
    paddingHorizontal: sharedTokens.spacing.mdTight,
    gap: sharedTokens.spacing.sm,
    borderTopWidth: 1,
    overflow: 'hidden'
  },
  toolbarBtn: {
    width: 44,
    height: 40,
    borderRadius: sharedTokens.radius.control
  }
})
