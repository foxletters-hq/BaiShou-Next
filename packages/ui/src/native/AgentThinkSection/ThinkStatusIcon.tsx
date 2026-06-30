import React from 'react'
import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import Svg, { Path } from 'react-native-svg'

/** 对齐 @ant-design/x Think 默认图标（完成态） */
function ThinkGlyph({ color, size }: { color: string; size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 1024 1024" fill={color}>
      <Path d="M847.936 168.448c65.088 65.664 46.144 198.528-36.224 337.536 88.128 143.04 109.824 281.408 43.008 348.8-66.56 67.072-202.688 45.696-343.808-41.984-141.12 87.68-277.248 109.056-343.808 41.984-66.816-67.392-45.056-205.76 43.008-348.8-82.368-139.008-101.248-271.872-36.16-337.536 65.408-65.92 198.336-46.336 336.96 37.76l9.728-5.76c135.104-79.232 263.36-96.448 327.296-32zM249.088 565.568l-2.24 4.16a536.704 536.704 0 0 0-38.272 85.696c-28.928 85.888-16.128 134.144 3.584 153.984 19.712 19.776 67.52 32.768 152.704 3.584a531.84 531.84 0 0 0 87.616-40.064c-35.84-26.816-71.488-57.664-105.792-92.288a950.4 950.4 0 0 1-97.6-115.072z m523.648 0.064l-2.56 3.584c-27.392 37.76-59.2 75.328-94.976 111.424a951.744 951.744 0 0 1-105.856 92.288c30.336 17.088 59.904 30.528 87.68 40.064 85.12 29.184 132.992 16.192 152.64-3.584 19.712-19.84 32.576-68.096 3.584-153.984a541.824 541.824 0 0 0-40.512-89.792z m-261.76-283.2l-17.664 12.416c-36.352 26.24-72.96 57.472-108.416 93.184a878.208 878.208 0 0 0-99.008 118.656c28.8 42.88 64.128 86.528 105.792 128.512a874.24 874.24 0 0 0 119.232 100.928 875.84 875.84 0 0 0 119.232-100.928 871.232 871.232 0 0 0 105.728-128.448 868.224 868.224 0 0 0-98.944-118.72 867.136 867.136 0 0 0-126.016-105.6z m3.2 105.472a11.52 11.52 0 0 1 7.808 7.808l7.232 24.512c10.432 35.2 37.888 62.72 73.088 73.152l24.192 7.168a11.52 11.52 0 0 1 0.064 22.144l-24.704 7.424A108.288 108.288 0 0 0 529.28 603.008l-7.296 24.576a11.52 11.52 0 0 1-22.144 0l-7.296-24.576a108.288 108.288 0 0 0-72.576-72.96l-24.704-7.36a11.52 11.52 0 0 1 0-22.144l24.32-7.168c35.136-10.432 62.592-37.952 73.024-73.152l7.232-24.512a11.52 11.52 0 0 1 14.336-7.808z m136.064-177.664a522.496 522.496 0 0 0-79.872 35.776c37.76 27.84 75.456 60.16 111.552 96.64a956.16 956.16 0 0 1 89.856 104.32c14.656-27.392 26.24-54.016 34.688-79.168 28.928-85.888 16.064-134.08-3.52-153.984-19.712-19.776-67.52-32.768-152.704-3.584z m-431.36 3.584c-19.584 19.84-32.512 68.096-3.52 153.984 8.512 25.152 20.096 51.776 34.688 79.168 26.24-35.392 56.32-70.528 89.856-104.32a948.224 948.224 0 0 1 111.616-96.64 514.816 514.816 0 0 0-79.936-35.776c-85.12-29.184-132.928-16.192-152.64 3.584z" />
    </Svg>
  )
}

export function ThinkStatusIcon({
  loading,
  color,
  size = 16
}: {
  loading: boolean
  color: string
  size?: number
}) {
  if (loading) {
    return (
      <View style={styles.iconBox} collapsable={false}>
        <ActivityIndicator key="think-spinner" size="small" color={color} />
      </View>
    )
  }

  return (
    <View style={styles.iconBox}>
      <ThinkGlyph color={color} size={size} />
    </View>
  )
}

export function ThinkChevron({
  expanded,
  color
}: {
  expanded: boolean
  color: string
}) {
  return (
    <MaterialIcons
      name="chevron-right"
      size={12}
      color={color}
      style={{ transform: [{ rotate: expanded ? '90deg' : '0deg' }] }}
    />
  )
}

/** 对齐桌面 ToolOutlined / CloseCircleOutlined */
export function ToolStatusIcon({
  loading,
  status,
  color,
  errorColor
}: {
  loading: boolean
  status: 'loading' | 'success' | 'error'
  color: string
  errorColor: string
}) {
  if (loading) {
    return (
      <View style={styles.iconBox}>
        <ActivityIndicator size="small" color={color} />
      </View>
    )
  }

  if (status === 'error') {
    return (
      <View style={styles.iconBox}>
        <MaterialIcons name="cancel" size={16} color={errorColor} />
      </View>
    )
  }

  return (
    <View style={styles.iconBox}>
      <MaterialIcons name="build" size={15} color={color} />
    </View>
  )
}

const styles = StyleSheet.create({
  iconBox: {
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center'
  }
})
