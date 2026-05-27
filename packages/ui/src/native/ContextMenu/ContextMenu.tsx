import React from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Pressable,
  StyleSheet,
  type ViewProps
} from 'react-native'
import { useNativeTheme } from '../theme'

export interface ContextMenuItem {
  label: string
  icon?: string
  onPress: () => void
  destructive?: boolean
}

export interface ContextMenuProps extends ViewProps {
  visible: boolean
  onClose: () => void
  anchorPosition: { x: number; y: number }
  items: ContextMenuItem[]
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
  visible,
  onClose,
  anchorPosition,
  items,
  style,
  ...props
}) => {
  const { colors, tokens } = useNativeTheme()

  if (!visible) return null

  const handleItemPress = (item: ContextMenuItem) => {
    onClose()
    setTimeout(() => item.onPress(), 50)
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View
          style={[
            styles.menu,
            {
              backgroundColor: colors.bgSurfaceHighest,
              borderColor: colors.borderSubtle,
              borderRadius: tokens.radius.md,
              left: anchorPosition.x,
              top: anchorPosition.y,
              ...(tokens.shadow as any)
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
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1
  },
  menu: {
    position: 'absolute',
    minWidth: 160,
    maxWidth: 240,
    borderWidth: 1,
    overflow: 'hidden'
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
    gap: 10
  },
  menuIcon: {
    fontSize: 16,
    width: 22,
    textAlign: 'center'
  },
  menuLabel: {
    fontSize: 15
  }
})
