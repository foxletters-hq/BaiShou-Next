import React from 'react'
import { View, StyleSheet } from 'react-native'
import {
  SettingsGroupDivider,
  AppearanceSettingsCard,
  IdentitySettingsCard,
  WorkspaceSettingsCard,
  ChatBackgroundSettingsCard
} from '@baishou/ui/native'
import { SettingsProfileHeader } from './SettingsProfileHeader'
import { useSettingsAccount } from './useSettingsAccount'

export interface QuickSettingsGroupProps {
  groupCardStyle: object
}

/** 个人资料分组卡片内容（用户 / 身份卡 / 工作区 / 外观 / 聊天背景） */
export const QuickSettingsGroup: React.FC<QuickSettingsGroupProps> = ({ groupCardStyle }) => {
  const account = useSettingsAccount()

  return (
    <View style={[styles.groupCard, groupCardStyle]}>
      <SettingsProfileHeader
        profile={account.profile}
        onSave={account.handleSaveProfile}
        disabled={!account.accountReady}
        embedded
      />

      <IdentitySettingsCard
        embedded
        profile={account.identityProfile}
        onChange={account.handleIdentityChange}
        onManageIdentity={
          account.accountReady ? () => account.router.push('/settings/identity-cards') : undefined
        }
      />
      <SettingsGroupDivider />
      <WorkspaceSettingsCard
        embedded
        vaults={account.vaults}
        activeVault={account.activeVault}
        onSwitch={account.handleSwitchVault}
        onDelete={account.handleDeleteVault}
        onCreate={account.handleCreateVault}
        onManageWorkspace={
          account.accountReady ? () => account.router.push('/settings/workspaces') : undefined
        }
      />
      <SettingsGroupDivider />
      <AppearanceSettingsCard
        embedded
        isLast={false}
        themeMode={account.themeMode}
        seedColor={account.seedColor}
        language={account.language as 'system' | 'zh' | 'zh-TW' | 'en' | 'ja'}
        fontSizeLevel={account.fontSizeLevel}
        onThemeModeChange={account.handleSaveTheme}
        onSeedColorChange={account.handleSeedColorChange}
        onLanguageChange={account.handleSaveLanguage}
        onFontSizeLevelChange={account.handleFontSizeLevelChange}
      />
      <SettingsGroupDivider />
      <ChatBackgroundSettingsCard
        embedded
        isLast
        backgroundPath={account.chatBackgroundPath}
        resolvedBackgroundUri={account.resolvedBackgroundUri}
        blur={account.chatBackgroundBlur}
        overlayOpacity={account.chatBackgroundOverlayOpacity}
        onPickBackground={account.handlePickBackground}
        onClearBackground={account.handleClearBackground}
        onBlurChange={(value) =>
          void account.saveChatBackgroundStyle({ chatBackgroundBlur: value })
        }
        onOverlayOpacityChange={(value) =>
          void account.saveChatBackgroundStyle({ chatBackgroundOverlayOpacity: value })
        }
      />
    </View>
  )
}

/** @deprecated 使用 QuickSettingsGroup + SettingsScreen 统一布局 */
export const SettingsAccountPanel = QuickSettingsGroup

const styles = StyleSheet.create({
  groupCard: {
    overflow: 'hidden'
  }
})
