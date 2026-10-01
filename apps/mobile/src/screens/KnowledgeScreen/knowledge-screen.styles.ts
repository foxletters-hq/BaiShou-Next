import type { ViewStyle, TextStyle, ImageStyle } from 'react-native'
import type { useNativeTheme } from '@baishou/ui/native'
import { settingsTypography } from '@baishou/ui/theme/tokens'

type ThemeColors = ReturnType<typeof useNativeTheme>['colors']
type ThemeTokens = ReturnType<typeof useNativeTheme>['tokens']

export interface KnowledgeScreenStyles {
  container: ViewStyle
  centerLoading: ViewStyle
  listContent: ViewStyle
  gridRow: ViewStyle
  errorText: TextStyle

  // Hero Stats Banner
  heroCard: ViewStyle
  heroHeader: ViewStyle
  heroBrandWrap: ViewStyle
  heroIconBadge: ViewStyle
  heroTitle: TextStyle
  heroSubtitle: TextStyle
  indexingPill: ViewStyle
  indexingDot: ViewStyle
  indexingText: TextStyle
  statsGrid: ViewStyle
  statItem: ViewStyle
  statValue: TextStyle
  statLabel: TextStyle
  statDivider: ViewStyle

  // 笔记本卡片 (Grid Card)
  notebookCardWrapper: ViewStyle
  notebookCardInner: ViewStyle
  coverArea: ViewStyle
  coverImage: ImageStyle
  coverOverlay: ViewStyle
  coverEmoji: TextStyle
  coverMenuBtn: ViewStyle
  cardPendingPill: ViewStyle
  cardPendingText: TextStyle
  cardContent: ViewStyle
  notebookName: TextStyle
  notebookMeta: TextStyle
  notebookStorage: TextStyle
  notebookDesc: TextStyle

  // 新增方块卡片 (Create Card)
  createCardInner: ViewStyle
  createCardIcon: ViewStyle
  createCardTitle: TextStyle
  createCardDesc: TextStyle

  // 空状态
  emptyContainer: ViewStyle
  emptyIconCircle: ViewStyle
  emptyTitle: TextStyle
  emptyDesc: TextStyle

  // ActionSheet 操作菜单
  actionSheetItem: ViewStyle
  actionSheetItemText: TextStyle
  actionSheetDestructiveText: TextStyle
}

export function createKnowledgeScreenStyles(
  colors: ThemeColors,
  tokens: ThemeTokens,
  isDark: boolean
): KnowledgeScreenStyles {
  return {
    container: {
      flex: 1,
      backgroundColor: colors.bgApp
    },
    centerLoading: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center'
    },
    listContent: {
      padding: tokens.spacing.md,
      gap: tokens.spacing.md
    },
    gridRow: {
      gap: tokens.spacing.md,
      justifyContent: 'space-between'
    },
    errorText: {
      color: colors.error,
      fontSize: settingsTypography.desc.fontSize,
      marginBottom: tokens.spacing.sm
    },

    // Hero Stats Banner 样式
    heroCard: {
      backgroundColor: colors.bgSurface,
      borderRadius: tokens.radius.xl,
      borderWidth: 1,
      borderColor: colors.borderMuted,
      padding: tokens.spacing.md,
      marginBottom: tokens.spacing.xs,
      overflow: 'hidden'
    },
    heroHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: tokens.spacing.md
    },
    heroBrandWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: tokens.spacing.sm
    },
    heroIconBadge: {
      width: 32,
      height: 32,
      borderRadius: tokens.radius.md,
      backgroundColor: colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center'
    },
    heroTitle: {
      fontSize: settingsTypography.section.fontSize,
      fontWeight: '700',
      color: colors.textPrimary,
      letterSpacing: -0.2
    },
    heroSubtitle: {
      fontSize: settingsTypography.meta.fontSize,
      color: colors.textSecondary
    },
    indexingPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: tokens.spacing.sm,
      paddingVertical: 3,
      borderRadius: tokens.radius.full,
      backgroundColor: colors.primaryLight
    },
    indexingDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.primary
    },
    indexingText: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.primary
    },
    statsGrid: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: tokens.spacing.sm,
      borderTopWidth: 1,
      borderTopColor: colors.borderSubtle
    },
    statItem: {
      flex: 1,
      alignItems: 'center'
    },
    statValue: {
      fontSize: 17,
      fontWeight: '700',
      color: colors.textPrimary
    },
    statLabel: {
      fontSize: 11,
      color: colors.textSecondary,
      marginTop: 2
    },
    statDivider: {
      width: 1,
      height: 24,
      backgroundColor: colors.borderSubtle
    },

    // 笔记本卡片样式 (Grid Card)
    notebookCardWrapper: {
      flex: 1,
      minWidth: 0
    },
    notebookCardInner: {
      padding: 0,
      overflow: 'hidden',
      borderRadius: tokens.radius.lg
    },
    coverArea: {
      height: 104,
      width: '100%',
      position: 'relative',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden'
    },
    coverImage: {
      width: '100%',
      height: '100%',
      position: 'absolute',
      left: 0,
      top: 0
    },
    coverOverlay: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      height: 48,
      backgroundColor: 'rgba(0, 0, 0, 0.35)'
    },
    coverEmoji: {
      fontSize: 40,
      lineHeight: 46
    },
    coverMenuBtn: {
      position: 'absolute',
      top: tokens.spacing.xs,
      right: tokens.spacing.xs,
      width: 28,
      height: 28,
      borderRadius: tokens.radius.full,
      backgroundColor: isDark ? 'rgba(0, 0, 0, 0.45)' : 'rgba(255, 255, 255, 0.72)',
      alignItems: 'center',
      justifyContent: 'center'
    },
    cardPendingPill: {
      position: 'absolute',
      bottom: tokens.spacing.xs,
      left: tokens.spacing.xs,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: tokens.radius.full,
      backgroundColor: 'rgba(0, 0, 0, 0.6)'
    },
    cardPendingText: {
      fontSize: 10,
      fontWeight: '600',
      color: '#f8fafc'
    },
    cardContent: {
      padding: tokens.spacing.sm,
      gap: 3
    },
    notebookName: {
      fontSize: settingsTypography.label.fontSize,
      fontWeight: '600',
      color: colors.textPrimary,
      lineHeight: 18
    },
    notebookMeta: {
      fontSize: 11,
      color: colors.textSecondary
    },
    notebookStorage: {
      fontSize: 10,
      color: colors.textSecondary,
      opacity: 0.85
    },
    notebookDesc: {
      fontSize: 11,
      color: colors.textSecondary,
      marginTop: 2
    },

    // 新增方块卡片 (Create Card)
    createCardInner: {
      minHeight: 182,
      alignItems: 'center',
      justifyContent: 'center',
      padding: tokens.spacing.md,
      borderWidth: 1.5,
      borderStyle: 'dashed',
      borderColor: isDark ? 'rgba(255, 255, 255, 0.16)' : 'rgba(0, 0, 0, 0.12)',
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.015)',
      borderRadius: tokens.radius.lg
    },
    createCardIcon: {
      width: 46,
      height: 46,
      borderRadius: tokens.radius.full,
      backgroundColor: colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: tokens.spacing.sm
    },
    createCardTitle: {
      fontSize: settingsTypography.label.fontSize,
      fontWeight: '700',
      color: colors.textPrimary,
      marginBottom: 3
    },
    createCardDesc: {
      fontSize: 11,
      color: colors.textSecondary
    },

    // 空状态样式
    emptyContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: tokens.spacing.xl * 1.5,
      paddingHorizontal: tokens.spacing.lg
    },
    emptyIconCircle: {
      width: 80,
      height: 80,
      borderRadius: tokens.radius.full,
      backgroundColor: colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: tokens.spacing.md
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.textPrimary,
      marginBottom: tokens.spacing.xs,
      textAlign: 'center'
    },
    emptyDesc: {
      fontSize: settingsTypography.desc.fontSize,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
      marginBottom: tokens.spacing.lg
    },

    // ActionSheet 操作菜单样式
    actionSheetItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: tokens.spacing.sm + 2,
      paddingHorizontal: tokens.spacing.sm,
      borderRadius: tokens.radius.md,
      gap: tokens.spacing.sm
    },
    actionSheetItemText: {
      fontSize: settingsTypography.row.fontSize,
      fontWeight: '500',
      color: colors.textPrimary
    },
    actionSheetDestructiveText: {
      fontSize: settingsTypography.row.fontSize,
      fontWeight: '500',
      color: colors.error
    }
  }
}
