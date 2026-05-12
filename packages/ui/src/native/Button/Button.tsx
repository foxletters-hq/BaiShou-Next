import React from 'react';
import { Pressable, Text, PressableProps, ActivityIndicator } from 'react-native';
import { useNativeTheme } from '../theme';

export interface NativeButtonProps extends PressableProps {
  variant?: 'elevated' | 'text' | 'outlined';
  isLoading?: boolean;
  children: React.ReactNode;
}

export const Button: React.FC<NativeButtonProps> = ({
  variant = 'elevated',
  isLoading = false,
  children,
  style,
  disabled,
  ...props
}) => {
  const { colors, tokens } = useNativeTheme();

  const getContainerStyle = (pressed: boolean) => {
    let base: any = {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: tokens.spacing.sm,
      paddingHorizontal: tokens.spacing.lg,
      borderRadius: tokens.radius.full,
      gap: tokens.spacing.sm,
    };

    if (variant === 'elevated') {
      base.backgroundColor = pressed ? colors.primary + 'E6' : colors.primary;
      base.elevation = pressed ? 4 : 2;
      base.shadowColor = '#000';
      base.shadowOffset = { width: 0, height: pressed ? 2 : 1 };
      base.shadowOpacity = 0.2;
      base.shadowRadius = pressed ? 4 : 2;
    } else if (variant === 'outlined') {
      base.backgroundColor = pressed ? colors.bgSurfaceNormal : 'transparent';
      base.borderWidth = 1;
      base.borderColor = colors.primary;
    } else {
      base.backgroundColor = pressed ? colors.bgSurfaceNormal : 'transparent';
    }

    if (disabled || isLoading) {
      base.opacity = 0.6;
    }

    return [base, typeof style === 'function' ? style({ pressed }) : style];
  };

  const textColor = variant === 'elevated' ? colors.bgSurface : colors.primary;

  return (
    <Pressable style={({ pressed }) => getContainerStyle(pressed)} disabled={disabled || isLoading} {...props}>
      {isLoading ? <ActivityIndicator color={textColor} size="small" /> : null}
      <Text style={{ color: textColor, fontSize: 14, fontWeight: '600' }}>
        {children}
      </Text>
    </Pressable>
  );
};
