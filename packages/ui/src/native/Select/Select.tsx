import React, { useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, Modal, TouchableWithoutFeedback } from 'react-native';
import { useNativeTheme } from '../theme';
import { useTranslation } from 'react-i18next';


export interface NativeSelectOption {
  label: string;
  value: string;
}

export interface NativeSelectProps {
  options: NativeSelectOption[];
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  error?: string;
  style?: any;
}

export const Select: React.FC<NativeSelectProps> = ({ options, value, onValueChange, placeholder, error, style }) => {
  const { t } = useTranslation();
  const { colors, tokens } = useNativeTheme();
  const [modalVisible, setModalVisible] = useState(false);

  const selectedOpt = options.find((o) => o.value === value);

  return (
    <View style={style}>
      <TouchableOpacity 
        style={{
          backgroundColor: colors.bgSurfaceNormal,
          paddingHorizontal: tokens.spacing.md,
          paddingVertical: tokens.spacing.md,
          borderRadius: tokens.radius.sm,
          borderBottomWidth: 1,
          borderBottomColor: error ? colors.accentGreen : 'transparent',
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
        onPress={() => setModalVisible(true)}
      >
        <Text style={{ color: selectedOpt ? colors.textPrimary : colors.textSecondary, fontSize: 16 }}>
          {selectedOpt ? selectedOpt.label : placeholder || 'Select...'}
        </Text>
        <Text style={{ color: colors.textSecondary, fontSize: 12 }}>▼</Text>
      </TouchableOpacity>
      {error ? <Text style={{ color: colors.accentGreen, fontSize: 12, marginTop: tokens.spacing.xs }}>{error}</Text> : null}

      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <TouchableWithoutFeedback onPress={() => setModalVisible(false)}>
          <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <TouchableWithoutFeedback>
              <View style={{ backgroundColor: colors.bgSurface, borderTopLeftRadius: tokens.radius.lg, borderTopRightRadius: tokens.radius.lg, maxHeight: '50%' }}>
                <FlatList
                  data={options}
                  keyExtractor={(item) => item.value}
                  renderItem={({ item }) => (
                    <TouchableOpacity 
                      style={{ padding: tokens.spacing.md, borderBottomWidth: 1, borderBottomColor: colors.bgSurfaceNormal }}
                      onPress={() => { onValueChange?.(item.value); setModalVisible(false); }}
                    >
                      <Text style={{ color: colors.textPrimary, fontSize: 16, textAlign: 'center' }}>
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  )}
                />
                <TouchableOpacity style={{ padding: tokens.spacing.md, marginBottom: tokens.spacing.lg }} onPress={() => setModalVisible(false)}>
                  <Text style={{ color: colors.primary, fontSize: 16, textAlign: 'center', fontWeight: 'bold' }}>{t('common.cancel', '取消')}</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
};
