import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';


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
  const { t } = useTranslation();
  const month = selectedDate.getMonth() + 1;
  const day = selectedDate.getDate();
  const days = [t('common.sunday', '周日'), t('common.monday', '周一'), t('common.tuesday', '周二'), t('common.wednesday', '周三'), t('common.thursday', '周四'), t('common.friday', '周五'), t('common.saturday', '周六')];
  const weekDay = days[selectedDate.getDay()];
  
  const formattedDate = `${month}${t('common.month_unit', '月')}${day}${t('common.day_unit', '日')} ${weekDay}`;

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
        <Text style={styles.titleText}>{isSummaryMode ? t('diary.edit_summary', '编辑总结') : formattedDate}</Text>
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
