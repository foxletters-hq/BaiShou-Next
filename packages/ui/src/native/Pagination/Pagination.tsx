import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, Pressable, TextInput } from 'react-native';
import { useNativeTheme } from '../theme';

export interface NativePaginationProps {
  /** 当前页码（从 1 开始） */
  current: number;
  /** 总页数 */
  total: number;
  /** 页码变化回调 */
  onChange: (page: number) => void;
  /** 相邻页码按钮数量（默认 1） */
  siblingCount?: number;
  /** 是否显示首页/末页按钮 */
  showFirstLast?: boolean;
  /** 是否显示页码输入跳转框 */
  showJumper?: boolean;
  /** 是否禁用 */
  disabled?: boolean;
}

/** 计算页码范围 */
function getPageRange(current: number, total: number, siblingCount: number): (number | 'ellipsis')[] {
  const pages: (number | 'ellipsis')[] = [];

  const totalPageNumbers = siblingCount * 2 + 3;
  if (total <= totalPageNumbers) {
    for (let i = 1; i <= total; i++) {
      pages.push(i);
    }
    return pages;
  }

  const leftSiblingIndex = Math.max(current - siblingCount, 1);
  const rightSiblingIndex = Math.min(current + siblingCount, total);

  const showLeftEllipsis = leftSiblingIndex > 2;
  const showRightEllipsis = rightSiblingIndex < total - 1;

  if (!showLeftEllipsis) {
    for (let i = 1; i <= rightSiblingIndex + 1; i++) {
      pages.push(i);
    }
    pages.push('ellipsis');
    pages.push(total);
    return pages;
  }

  if (!showRightEllipsis) {
    pages.push(1);
    pages.push('ellipsis');
    for (let i = leftSiblingIndex - 1; i <= total; i++) {
      pages.push(i);
    }
    return pages;
  }

  pages.push(1);
  pages.push('ellipsis');
  for (let i = leftSiblingIndex; i <= rightSiblingIndex; i++) {
    pages.push(i);
  }
  pages.push('ellipsis');
  pages.push(total);

  return pages;
}

export const Pagination: React.FC<NativePaginationProps> = ({
  current,
  total,
  onChange,
  siblingCount = 1,
  showFirstLast = true,
  showJumper = true,
  disabled = false,
}) => {
  const { colors, tokens } = useNativeTheme();
  const [jumperValue, setJumperValue] = useState('');

  useEffect(() => {
    setJumperValue('');
  }, [current]);

  const handlePageChange = useCallback(
    (page: number) => {
      if (disabled) return;
      const safePage = Math.max(1, Math.min(total, page));
      if (safePage !== current) {
        onChange(safePage);
      }
    },
    [disabled, total, current, onChange],
  );

  const handleJumperSubmit = useCallback(() => {
    if (disabled) return;
    const page = parseInt(jumperValue, 10);
    if (!isNaN(page) && page >= 1 && page <= total) {
      handlePageChange(page);
    }
    setJumperValue('');
  }, [disabled, jumperValue, total, handlePageChange]);

  const pageRange = getPageRange(current, total, siblingCount);

  const renderPageButton = (page: number | 'ellipsis', index: number) => {
    if (page === 'ellipsis') {
      return (
        <View key={`ellipsis-${index}`} style={{ 
          paddingHorizontal: 8, 
          paddingVertical: 8,
          justifyContent: 'center',
          alignItems: 'center',
        }}>
          <Text style={{ color: colors.textSecondary, fontSize: 14 }}>···</Text>
        </View>
      );
    }

    const isActive = page === current;
    return (
      <Pressable
        key={page}
        onPress={() => handlePageChange(page)}
        disabled={disabled}
        style={{
          minWidth: 36,
          height: 36,
          borderRadius: tokens.radius.md,
          backgroundColor: isActive ? colors.primary : 'transparent',
          justifyContent: 'center',
          alignItems: 'center',
          opacity: disabled ? 0.5 : 1,
        }}
      >
        <Text style={{ 
          color: isActive ? colors.onPrimary : colors.textPrimary, 
          fontSize: 14,
          fontWeight: isActive ? '600' : '400',
        }}>
          {page}
        </Text>
      </Pressable>
    );
  };

  return (
    <View style={{ 
      flexDirection: 'row', 
      alignItems: 'center', 
      gap: tokens.spacing.xs,
      flexWrap: 'wrap',
      justifyContent: 'center',
    }}>
      {/* 首页按钮 */}
      {showFirstLast && (
        <Pressable
          onPress={() => handlePageChange(1)}
          disabled={disabled || current <= 1}
          style={{
            padding: 8,
            opacity: disabled || current <= 1 ? 0.3 : 1,
          }}
        >
          <Text style={{ color: colors.textPrimary, fontSize: 16 }}>⟨⟨</Text>
        </Pressable>
      )}

      {/* 上一页按钮 */}
      <Pressable
        onPress={() => handlePageChange(current - 1)}
        disabled={disabled || current <= 1}
        style={{
          padding: 8,
          opacity: disabled || current <= 1 ? 0.3 : 1,
        }}
      >
        <Text style={{ color: colors.textPrimary, fontSize: 16 }}>⟨</Text>
      </Pressable>

      {/* 页码按钮 */}
      {pageRange.map((page, index) => renderPageButton(page, index))}

      {/* 下一页按钮 */}
      <Pressable
        onPress={() => handlePageChange(current + 1)}
        disabled={disabled || current >= total}
        style={{
          padding: 8,
          opacity: disabled || current >= total ? 0.3 : 1,
        }}
      >
        <Text style={{ color: colors.textPrimary, fontSize: 16 }}>⟩</Text>
      </Pressable>

      {/* 末页按钮 */}
      {showFirstLast && (
        <Pressable
          onPress={() => handlePageChange(total)}
          disabled={disabled || current >= total}
          style={{
            padding: 8,
            opacity: disabled || current >= total ? 0.3 : 1,
          }}
        >
          <Text style={{ color: colors.textPrimary, fontSize: 16 }}>⟩⟩</Text>
        </Pressable>
      )}

      {/* 页码输入跳转 */}
      {showJumper && total > 1 && (
        <View style={{ 
          flexDirection: 'row', 
          alignItems: 'center', 
          marginLeft: tokens.spacing.sm,
          gap: tokens.spacing.xs,
        }}>
          <TextInput
            value={jumperValue}
            onChangeText={(text) => {
              const val = text.replace(/[^0-9]/g, '');
              setJumperValue(val);
            }}
            onSubmitEditing={handleJumperSubmit}
            keyboardType="numeric"
            placeholder="跳转"
            placeholderTextColor={colors.textTertiary}
            editable={!disabled}
            style={{
              width: 60,
              height: 36,
              borderWidth: 1,
              borderColor: colors.outlineVariant,
              borderRadius: tokens.radius.md,
              paddingHorizontal: 8,
              textAlign: 'center',
              color: colors.textPrimary,
              backgroundColor: colors.bgSurface,
              fontSize: 14,
            }}
          />
          <Text style={{ color: colors.textSecondary, fontSize: 14 }}>页</Text>
        </View>
      )}
    </View>
  );
};
