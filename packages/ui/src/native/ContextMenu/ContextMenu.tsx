import React, { useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  type LayoutChangeEvent,
  type ViewProps
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { mobileTypography, sharedTokens } from '../../theme/tokens'
import { useNativeTheme } from '../theme'
import { ANCHORED_MENU_MIN_WIDTH, computeAnchoredMenuPosition } from './anchored-menu-position.util'

export interface ContextMenuItem {
  label: string
  icon?: string
  onPress: () => void
  destructive?: boolean
}

export interface ContextMenuTriggerLayout {
  x: number
  y: number
  width: number
  height: number
}

export interface ContextMenuProps extends ViewProps {
  visible: boolean
  onClose: () => void
  /** 已算好的菜单左上角；没有 triggerLayout 时使用 */
  anchorPosition?: { x: number; y: number }
  /** measureInWindow 得到的触发器矩形；有则按规范自行定位，避免盖住按钮 */
  triggerLayout?: ContextMenuTriggerLayout
  items: ContextMenuItem[]
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
  visible,
  onClose,
  anchorPosition = { x: 0, y: 0 },
  triggerLayout,
  items,
  style,
  ...props
}) => {
  const { colors, tokens } = useNativeTheme()
  const insets = useSafeAreaInsets()
  const { width: windowWidth, height: windowHeight } = useWindowDimensions()
  const [menuSize, setMenuSize] = useState({ width: ANCHORED_MENU_MIN_WIDTH, height: 0 })
  const androidY = Platform.OS === 'android' ? insets.top : 0

  if (!visible) return null

  const handleItemPress = (item: ContextMenuItem) => {
    onClose()
    setTimeout(() => item.onPress(), 50)
  }

  const handleMenuLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout
    if (width === menuSize.width && height === menuSize.height) return
    setMenuSize({ width, height })
  }

  const position = triggerLayout
    ? computeAnchoredMenuPosition({
        triggerX: triggerLayout.x,
        triggerY: triggerLayout.y,
        triggerWidth: triggerLayout.width,
        triggerHeight: triggerLayout.height,
        windowWidth,
        windowHeight,
        menuWidth: menuSize.width,
        menuHeight: menuSize.height,
        triggerYOffset: androidY,
        placement: 'side'
      })
    : {
        left: anchorPosition.x,
        top: anchorPosition.y + androidY
      }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      presentationStyle="overFullScreen"
      onRequestClose={onClose}
    >
      <View style={styles.host} pointerEvents="box-none">
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View
          onLayout={handleMenuLayout}
          style={[
            styles.menu,
            {
              backgroundColor: colors.bgSurface,
              borderColor: colors.borderMuted,
              borderRadius: tokens.radius.sm,
              left: position.left,
              top: position.top
            },
            style
          ]}
          {...props}
        >
          {items.map((item, index) => (
            <TouchableOpacity
              key={index}
              onPress={() => handleItemPress(item)}
              activeOpacity={0.7}
              style={[
                styles.menuItem,
                index < items.length - 1 && {
                  borderBottomWidth: 1,
                  borderBottomColor: colors.borderSubtle
                }
              ]}
            >
              {item.icon ? (
                <Text
                  style={[
                    styles.menuIcon,
                    { color: item.destructive ? colors.error : colors.textSecondary }
                  ]}
                >
                  {item.icon}
                </Text>
              ) : null}
              <Text
                style={[
                  styles.menuLabel,
                  { color: item.destructive ? colors.error : colors.textPrimary }
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  host: {
    ...StyleSheet.absoluteFillObject
  },
  menu: {
    position: 'absolute',
    minWidth: ANCHORED_MENU_MIN_WIDTH,
    maxWidth: 200,
    borderWidth: 1,
    overflow: 'hidden'
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: sharedTokens.spacing.mdTight,
    paddingVertical: sharedTokens.spacing.sm,
    gap: sharedTokens.spacing.sm
  },
  menuIcon: {
    fontSize: mobileTypography.secondary.fontSize,
    width: 18,
    textAlign: 'center'
  },
  menuLabel: {
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: '500'
  }
})
