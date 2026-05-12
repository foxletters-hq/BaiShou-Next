import React, { useState } from 'react';
import { View, Text, Pressable, TextInput, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNativeTheme } from '../theme';

export interface AgentProfile {
  name: string;
  avatarPath?: string | null;
  emoji?: string | null;
  modelIdentifier?: string;
  tokenSize?: string;
}

export interface NativeChatAppBarProps {
  profile: AgentProfile;
  onClearChat?: () => void;
  onOpenMemory?: () => void;
  onOpenSettings?: () => void;
  onRenameChat?: (newName: string) => void;
}

export const ChatAppBar: React.FC<NativeChatAppBarProps> = ({
  profile,
  onClearChat,
  onOpenMemory,
  onOpenSettings,
  onRenameChat,
}) => {
  const { t } = useTranslation();
  const { colors, tokens } = useNativeTheme();
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(profile.name);

  const submitRename = () => {
    setIsEditing(false);
    if (editName.trim() && editName.trim() !== profile.name) {
      onRenameChat?.(editName.trim());
    } else {
      setEditName(profile.name);
    }
  };

  const handleClearChat = () => {
    if (onClearChat) {
      Alert.alert(
        t('common.confirm', '确认'),
        t('agent.chat.clear_confirm', '确定要清空聊天记录吗？'),
        [
          { text: t('common.cancel', '取消'), style: 'cancel' },
          { text: t('common.confirm', '确定'), onPress: onClearChat, style: 'destructive' },
        ]
      );
    }
  };

  const renderAvatar = () => (
    <View style={{
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.primaryContainer,
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      {profile.avatarPath ? (
        <Text style={{ fontSize: 20 }}>{profile.emoji || '🤖'}</Text>
      ) : (
        <Text style={{ fontSize: 20 }}>{profile.emoji || '🤖'}</Text>
      )}
    </View>
  );

  return (
    <View style={{
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: tokens.spacing.md,
      paddingVertical: tokens.spacing.sm,
      backgroundColor: colors.bgSurface,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderSubtle,
    }}>
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        gap: tokens.spacing.sm,
      }}>
        {renderAvatar()}
        
        <View style={{ flex: 1 }}>
          {isEditing ? (
            <TextInput
              value={editName}
              onChangeText={setEditName}
              onBlur={submitRename}
              onSubmitEditing={submitRename}
              autoFocus
              style={{
                fontSize: 16,
                fontWeight: '600',
                color: colors.textPrimary,
                padding: 0,
              }}
            />
          ) : (
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: tokens.spacing.xs,
            }}>
              <Text style={{
                fontSize: 16,
                fontWeight: '600',
                color: colors.textPrimary,
                flex: 1,
              }}>
                {profile.name}
              </Text>
              <Pressable 
                onPress={() => setIsEditing(true)}
                style={({ pressed }) => ({
                  opacity: pressed ? 0.5 : 1,
                })}
              >
                <Text style={{ fontSize: 14, color: colors.textSecondary }}>✎</Text>
              </Pressable>
            </View>
          )}
          
          {(profile.modelIdentifier || profile.tokenSize) && (
            <View style={{
              flexDirection: 'row',
              gap: tokens.spacing.xs,
              marginTop: 2,
            }}>
              {profile.modelIdentifier && (
                <View style={{
                  backgroundColor: colors.primaryContainer,
                  borderRadius: tokens.radius.full,
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                }}>
                  <Text style={{
                    fontSize: 11,
                    color: colors.onPrimaryContainer,
                  }}>
                    ✨ {profile.modelIdentifier}
                  </Text>
                </View>
              )}
              {profile.tokenSize && (
                <View style={{
                  backgroundColor: colors.secondaryContainer,
                  borderRadius: tokens.radius.full,
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                }}>
                  <Text style={{
                    fontSize: 11,
                    color: colors.onSecondaryContainer,
                  }}>
                    {profile.tokenSize} Tokens
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>
      </View>

      <View style={{
        flexDirection: 'row',
        gap: tokens.spacing.sm,
      }}>
        {onOpenMemory && (
          <Pressable 
            onPress={onOpenMemory}
            style={({ pressed }) => ({
              opacity: pressed ? 0.5 : 1,
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: colors.bgSurfaceNormal,
              alignItems: 'center',
              justifyContent: 'center',
            })}
          >
            <Text style={{ fontSize: 18 }}>🧠</Text>
          </Pressable>
        )}
        
        {onOpenSettings && (
          <Pressable 
            onPress={onOpenSettings}
            style={({ pressed }) => ({
              opacity: pressed ? 0.5 : 1,
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: colors.bgSurfaceNormal,
              alignItems: 'center',
              justifyContent: 'center',
            })}
          >
            <Text style={{ fontSize: 18 }}>⚙️</Text>
          </Pressable>
        )}
        
        {onClearChat && (
          <Pressable 
            onPress={handleClearChat}
            style={({ pressed }) => ({
              opacity: pressed ? 0.5 : 1,
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: colors.errorContainer,
              alignItems: 'center',
              justifyContent: 'center',
            })}
          >
            <Text style={{ fontSize: 18 }}>🗑️</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
};
