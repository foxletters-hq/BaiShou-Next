import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useNativeTheme } from '../theme';

/**
 * 获取年份范围
 * 从2000年开始，到当前年份+30年
 */
function getPickerYearRange(): number[] {
  const currentYear = new Date().getFullYear();
  const startYear = 2000;
  const endYear = currentYear + 30;
  const length = endYear - startYear + 1;
  return Array.from({ length }, (_, i) => startYear + i);
}

export interface YearMonthPickerProps {
  /** 当前选中的月份日期（Date对象，月份为该月1号） */
  selectedMonth: Date | null;
  /** 选择变化回调 */
  onChange: (date: Date | null) => void;
  /** 占位文本 */
  titlePlaceholder?: string;
}

export const YearMonthPicker: React.FC<YearMonthPickerProps> = ({
  selectedMonth,
  onChange,
  titlePlaceholder = '全部日期',
}) => {
  const { colors } = useNativeTheme();
  const [isOpen, setIsOpen] = useState(false);

  // 月份名称
  const monthNames = useMemo(
    () => ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
    []
  );

  // 年份列表
  const years = useMemo(() => getPickerYearRange(), []);

  // 内部视图状态
  const [viewYear, setViewYear] = useState(() => {
    return selectedMonth?.getFullYear() ?? new Date().getFullYear();
  });

  // 当前物理年月
  const currentPhysicalYear = new Date().getFullYear();
  const currentPhysicalMonth = new Date().getMonth() + 1;

  // 年份ScrollView引用
  const yearScrollViewRef = React.useRef<ScrollView>(null);

  useEffect(() => {
    if (isOpen && selectedMonth) {
      setViewYear(selectedMonth.getFullYear());
    }
  }, [isOpen, selectedMonth]);

  // 滚动到选中的年份
  useEffect(() => {
    if (isOpen && yearScrollViewRef.current) {
      const yearIndex = years.indexOf(viewYear);
      if (yearIndex >= 0) {
        setTimeout(() => {
          yearScrollViewRef.current?.scrollTo({
            y: yearIndex * 44,
            animated: false,
          });
        }, 100);
      }
    }
  }, [isOpen, viewYear, years]);

  const handleSelectMonth = useCallback(
    (m: number) => {
      onChange(new Date(viewYear, m - 1, 1));
      setIsOpen(false);
    },
    [viewYear, onChange]
  );

  const handleClear = useCallback(() => {
    onChange(null);
    setIsOpen(false);
  }, [onChange]);

  const handleThisMonth = useCallback(() => {
    const now = new Date();
    onChange(new Date(now.getFullYear(), now.getMonth(), 1));
    setIsOpen(false);
  }, [onChange]);

  // 显示文本
  const displayText = useMemo(() => {
    if (!selectedMonth) return titlePlaceholder;
    const y = selectedMonth.getFullYear();
    const m = monthNames[selectedMonth.getMonth()];
    return `${y}年${m}`;
  }, [selectedMonth, monthNames, titlePlaceholder]);

  return (
    <>
      {/* 触发按钮 */}
      <TouchableOpacity
        style={[styles.triggerBtn, { backgroundColor: colors.bgSurfaceHighest }]}
        onPress={() => setIsOpen(true)}
      >
        <Text
          style={[
            styles.triggerText,
            { color: selectedMonth ? colors.primary : colors.textSecondary },
          ]}
        >
          {displayText}
        </Text>
        <Text style={[styles.triggerArrow, { color: colors.textSecondary }]}>
          ▼
        </Text>
      </TouchableOpacity>

      {/* 模态弹窗 */}
      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsOpen(false)}
      >
        <TouchableOpacity
          style={[styles.overlay, { backgroundColor: colors.bgApp + 'CC' }]}
          activeOpacity={1}
          onPress={() => setIsOpen(false)}
        >
          <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
            <View style={[styles.modalContent, { backgroundColor: colors.bgSurface }]}>
              {/* 标题栏 */}
              <View style={[styles.header, { borderBottomColor: colors.borderSubtle }]}>
                <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
                  选择年月
                </Text>
                <TouchableOpacity onPress={() => setIsOpen(false)}>
                  <Text style={[styles.closeBtn, { color: colors.textSecondary }]}>
                    ✕
                  </Text>
                </TouchableOpacity>
              </View>

              {/* 年月选择区域 */}
              <View style={styles.pickerContainer}>
                {/* 左侧：年份列表 */}
                <View style={[styles.yearPane, { borderRightColor: colors.borderSubtle }]}>
                  <ScrollView
                    ref={yearScrollViewRef}
                    style={styles.yearList}
                    showsVerticalScrollIndicator={false}
                  >
                    {years.map((y) => {
                      const isActive = viewYear === y;
                      const isSelectedYear =
                        selectedMonth?.getFullYear() === y;
                      return (
                        <TouchableOpacity
                          key={y}
                          style={[
                            styles.yearItem,
                            isActive && {
                              backgroundColor: colors.primary + '20',
                            },
                            isSelectedYear &&
                              !isActive && {
                                backgroundColor: colors.bgSurfaceHighest,
                              },
                          ]}
                          onPress={() => setViewYear(y)}
                        >
                          <Text
                            style={[
                              styles.yearText,
                              {
                                color: isActive
                                  ? colors.primary
                                  : colors.textPrimary,
                                fontWeight: isActive ? '700' : '400',
                              },
                            ]}
                          >
                            {y}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>

                {/* 右侧：月份网格 */}
                <View style={styles.monthPane}>
                  <View style={styles.monthGrid}>
                    {monthNames.map((name, index) => {
                      const m = index + 1;
                      const isSelected =
                        selectedMonth?.getFullYear() === viewYear &&
                        selectedMonth?.getMonth() + 1 === m;
                      const isCurrentMonth =
                        currentPhysicalYear === viewYear &&
                        currentPhysicalMonth === m;
                      return (
                        <TouchableOpacity
                          key={m}
                          style={[
                            styles.monthItem,
                            {
                              backgroundColor: isSelected
                                ? colors.primary
                                : isCurrentMonth
                                ? colors.primary + '15'
                                : colors.bgSurfaceHighest,
                              borderColor: isCurrentMonth && !isSelected
                                ? colors.primary
                                : 'transparent',
                            },
                          ]}
                          onPress={() => handleSelectMonth(m)}
                        >
                          <Text
                            style={[
                              styles.monthText,
                              {
                                color: isSelected
                                  ? colors.bgSurface
                                  : isCurrentMonth
                                  ? colors.primary
                                  : colors.textPrimary,
                              },
                            ]}
                          >
                            {name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              </View>

              {/* 底部操作栏 */}
              <View style={[styles.footer, { borderTopColor: colors.borderSubtle }]}>
                <TouchableOpacity
                  style={[
                    styles.footerBtn,
                    { backgroundColor: colors.bgSurfaceHighest },
                  ]}
                  onPress={handleClear}
                >
                  <Text
                    style={[styles.footerBtnText, { color: colors.textSecondary }]}
                  >
                    查看全部
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.footerBtn,
                    { backgroundColor: colors.primary },
                  ]}
                  onPress={handleThisMonth}
                >
                  <Text
                    style={[styles.footerBtnText, { color: colors.bgSurface }]}
                  >
                    跳转本月
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  triggerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 120,
  },
  triggerText: {
    fontSize: 14,
    fontWeight: '600',
  },
  triggerArrow: {
    fontSize: 10,
    marginLeft: 8,
  },
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 16,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  closeBtn: {
    fontSize: 18,
    fontWeight: '600',
    padding: 4,
  },
  pickerContainer: {
    flexDirection: 'row',
    height: 300,
  },
  yearPane: {
    width: 100,
    borderRightWidth: 1,
  },
  yearList: {
    flex: 1,
  },
  yearItem: {
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  yearText: {
    fontSize: 15,
  },
  monthPane: {
    flex: 1,
    padding: 8,
  },
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
  },
  monthItem: {
    width: '30%',
    height: 44,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  monthText: {
    fontSize: 14,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 12,
    borderTopWidth: 1,
    gap: 12,
  },
  footerBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  footerBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
