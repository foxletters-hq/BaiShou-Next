import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface DiaryEditorAppBarTitleProps {
  isSummaryMode: boolean;
  selectedDate: Date;
  onDateChanged?: (date: Date) => void;
}

export const DiaryEditorAppBarTitle: React.FC<DiaryEditorAppBarTitleProps> = ({
  isSummaryMode,
  selectedDate,
  onDateChanged
}) => {
  const month = selectedDate.getMonth() + 1;
  const day = selectedDate.getDate();
  const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const weekDay = days[selectedDate.getDay()];
  
  const formattedDate = `${month}月${day}日 ${weekDay}`;

  return (
    <TouchableOpacity 
      style={styles.container} 
      activeOpacity={0.6}
      onPress={() => {
        // Native would show DateTimePicker here, mocking log for now
        console.log('Would open native date picker');
        if (onDateChanged) onDateChanged(new Date());
      }}
    >
      <View style={styles.titleContent}>
        <Text style={styles.titleText}>{isSummaryMode ? '编辑总结' : formattedDate}</Text>
        {!isSummaryMode && <Text style={styles.titleIcon}>▼</Text>}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: 'transparent',
  },
  titleContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  titleText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  titleIcon: {
    fontSize: 10,
    color: '#475569',
  }
});
