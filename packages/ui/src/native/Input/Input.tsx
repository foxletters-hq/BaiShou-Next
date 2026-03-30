import React, { useState } from 'react';
import { View, TextInput, Text, TextInputProps } from 'react-native';
import { useNativeTheme } from '../theme';

export interface NativeInputProps extends TextInputProps {
  label?: string;
  error?: string;
  containerStyle?: any;
}

export const Input: React.FC<NativeInputProps> = ({ label, error, containerStyle, style, ...props }) => {
  const { colors, tokens } = useNativeTheme();
  const [isFocused, setIsFocused] = useState(false);
  const [hasValue, setHasValue] = useState(!!props.value || !!props.defaultValue);

  return (
    <View style={[{ width: '100%', gap: tokens.spacing.xs }, containerStyle]}>
      <View
        style={{
          backgroundColor: colors.bgSurfaceHighlight,
          borderRadius: tokens.radius.sm,
          paddingHorizontal: tokens.spacing.md,
          paddingTop: tokens.spacing.lg,
          paddingBottom: tokens.spacing.sm,
          borderBottomWidth: 1,
          borderBottomColor: error ? colors.accentGreen : isFocused ? colors.primary : 'transparent',
        }}
      >
        {label && (
           <Text style={{
             position: 'absolute',
             left: tokens.spacing.md,
             top: isFocused || hasValue || props.placeholder ? tokens.spacing.sm : 16,
             fontSize: isFocused || hasValue || props.placeholder ? 12 : 16,
             color: colors.textSecondary,
           }}>
             {label}
           </Text>
        )}
        <TextInput
          style={[{
            color: colors.textPrimary,
            fontSize: 16,
            padding: 0,
            margin: 0,
          }, style]}
          placeholderTextColor={colors.textSecondary}
          onFocus={(e) => { setIsFocused(true); props.onFocus?.(e); }}
          onBlur={(e) => { setIsFocused(false); props.onBlur?.(e); }}
          onChangeText={(t) => { setHasValue(!!t); props.onChangeText?.(t); }}
          {...props}
        />
      </View>
      {error ? (
        <Text style={{ color: colors.accentGreen, fontSize: 12 }}>{error}</Text>
      ) : null}
    </View>
  );
};
