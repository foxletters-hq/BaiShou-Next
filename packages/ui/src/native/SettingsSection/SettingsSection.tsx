import React from 'react';
import { View, Text, ViewProps } from 'react-native';
import { useNativeTheme } from '../theme';

export interface NativeSettingsSectionProps extends ViewProps {
  title: string;
  description?: string;
  children: React.ReactNode;
}

export const SettingsSection: React.FC<NativeSettingsSectionProps> = ({ 
  title, 
  description, 
  children,
  style,
  ...props 
}) => {
  const { colors, tokens } = useNativeTheme();

  return (
    <View 
      style={[
        {
          marginBottom: tokens.spacing.lg,
        },
        style,
      ]}
      {...props}
    >
      <View style={{ 
        paddingHorizontal: tokens.spacing.lg,
        marginBottom: tokens.spacing.sm,
      }}>
        <Text style={{ 
          fontSize: 18, 
          fontWeight: '600', 
          color: colors.textPrimary,
        }}>
          {title}
        </Text>
        {description && (
          <Text style={{ 
            fontSize: 14, 
            color: colors.textSecondary,
            marginTop: 4,
          }}>
            {description}
          </Text>
        )}
      </View>
      
      <View style={{
        backgroundColor: colors.bgSurface,
        borderRadius: tokens.radius.lg,
        overflow: 'hidden',
      }}>
        {children}
      </View>
    </View>
  );
};
