import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, StatusBar } from 'react-native';

const useTranslation = (): { t: (key: string) => string } => ({
  t: (key: string) => key,
});

export const SettingsScreen: React.FC = () => {
  const { t } = useTranslation();

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="#0B0E14" />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>主控矩阵</Text>
            <Text style={styles.headerSubtitle}>CORE PARAMETERS (B8.3)</Text>
          </View>
          
          <ScrollView style={styles.contentContainer} indicatorStyle="white">
            <View style={styles.warningBox}>
               <Text style={styles.warningIcon}>🛡️</Text>
               <Text style={styles.warningText}>
                  核心协议连接已加密。移动端配置正在与跨星区网络（Desktop WebDAV）握手同步。
               </Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>通用架构</Text>
              
              <TouchableOpacity style={styles.settingItem} activeOpacity={0.7}>
                <View style={styles.settingItemLeft}>
                  <View style={styles.iconBg}><Text style={styles.iconText}>🧠</Text></View>
                  <Text style={styles.settingText}>接入模型与算力</Text>
                </View>
                <Text style={styles.arrowText}>&gt;</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.settingItem} activeOpacity={0.7}>
                <View style={styles.settingItemLeft}>
                   <View style={styles.iconBg}><Text style={styles.iconText}>🗄️</Text></View>
                   <Text style={styles.settingText}>记忆与存储节点</Text>
                </View>
                <Text style={styles.arrowText}>&gt;</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.settingItem} activeOpacity={0.7}>
                <View style={styles.settingItemLeft}>
                   <View style={styles.iconBg}><Text style={styles.iconText}>🌐</Text></View>
                   <Text style={styles.settingText}>语言界限 (Language)</Text>
                </View>
                <Text style={styles.arrowText}>&gt;</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>危险区 (Danger Zone)</Text>
              <TouchableOpacity style={[styles.settingItem, styles.dangerItem]} activeOpacity={0.7}>
                 <Text style={styles.dangerText}>☢️ 切断所有神经元注入</Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.footerMarker}>
               <Text style={styles.footerMarkerText}>[ VERSION: v4.0.0-Next.Alpha ]</Text>
            </View>
          </ScrollView>
        </View>
      </SafeAreaView>
    </>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0B0E14' },
  container: { flex: 1, backgroundColor: '#0B0E14' },
  header: {
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20,
    backgroundColor: '#0F131A', 
    borderBottomWidth: 1, borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  headerTitle: { fontSize: 28, fontWeight: '900', color: '#FFF', letterSpacing: -0.5 },
  headerSubtitle: { fontSize: 10, fontWeight: '700', color: '#5BA8F5', marginTop: 4, letterSpacing: 1.5 },
  
  contentContainer: { flex: 1, padding: 20 },
  
  warningBox: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16,
    backgroundColor: 'rgba(16, 185, 129, 0.1)', 
    borderRadius: 12, borderWidth: 1, borderColor: 'rgba(16, 185, 129, 0.2)',
    marginBottom: 32
  },
  warningIcon: { fontSize: 20 },
  warningText: { flex: 1, fontSize: 13, color: '#10B981', lineHeight: 20, fontWeight: '600' },
  
  section: { marginBottom: 32 },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: '#64748B', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 },
  
  settingItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    padding: 16, borderRadius: 16, marginBottom: 8,
    borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.05)'
  },
  settingItemLeft: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  iconBg: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255, 255, 255, 0.06)', alignItems: 'center', justifyContent: 'center' },
  iconText: { fontSize: 16 },
  settingText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  arrowText: { fontSize: 16, color: '#64748B', fontWeight: '900' },
  
  dangerItem: { backgroundColor: 'rgba(239, 68, 68, 0.08)', borderColor: 'rgba(239, 68, 68, 0.2)', justifyContent: 'center' },
  dangerText: { color: '#EF4444', fontSize: 15, fontWeight: '800', letterSpacing: 0.5 },

  footerMarker: { alignItems: 'center', marginTop: 24, marginBottom: 40, opacity: 0.2 },
  footerMarkerText: { color: '#94A3B8', fontSize: 12, fontWeight: '800', letterSpacing: 2 },
});
