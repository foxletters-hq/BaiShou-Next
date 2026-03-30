import React from 'react';
import { View, StyleSheet } from 'react-native';
import { DiaryEditor } from '@baishou/ui';
import { useDiaryEditorMock } from './hooks/useDiaryEditorMock';

export const DiaryEditorScreen: React.FC = () => {
  const { state, actions } = useDiaryEditorMock('昨天没写完的东西...', true);

  return (
    <View style={styles.container}>
      <DiaryEditor 
        content={state.content}
        tags={state.tags}
        selectedDate={state.selectedDate}
        onContentChange={actions.setContent}
        onTagsChange={actions.setTags}
        onDateChange={actions.setSelectedDate}
        onSave={actions.handleSave}
        onCancel={actions.handleCancel}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' }
});
