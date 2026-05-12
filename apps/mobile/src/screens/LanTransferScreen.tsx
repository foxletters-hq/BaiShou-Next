import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, StatusBar, Alert, TextInput } from 'react-native';
import { useNativeTheme } from '@baishou/ui/src/native/theme';
import { useBaishou } from '../providers/BaishouProvider';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

interface LanDevice {
  id: string;
  name: string;
  ip: string;
  port: number;
  isOnline: boolean;
}

export const LanTransferScreen: React.FC = () => {
  const { t } = useTranslation();
  const { colors, isDark } = useNativeTheme();
  const { services, dbReady } = useBaishou();
  const router = useRouter();

  const [devices, setDevices] = useState<LanDevice[]>([]);
  const [scanning, setScanning] = useState(false);
  const [serverRunning, setServerRunning] = useState(false);
  const [serverPort, setServerPort] = useState('8080');

  const lanSyncService = services?.lanSyncService;

  // 组件卸载时停止发现，防止 Zeroconf 资源泄漏
  useEffect(() => {
    return () => {
      lanSyncService?.stopDiscovery().catch(() => {});
      lanSyncService?.stopBroadcasting().catch(() => {});
    };
  }, [lanSyncService]);

  const startScan = useCallback(async () => {
    if (!dbReady || !lanSyncService) return;
    setScanning(true);
    try {
      await lanSyncService.startDiscovery(
        (device) => {
          setDevices(prev => {
            if (prev.find(d => d.id === device.rawServiceId)) return prev;
            return [...prev, {
              id: device.rawServiceId,
              name: device.nickname,
              ip: device.ip,
              port: device.port,
              isOnline: true,
            }];
          });
        },
        (deviceId) => {
          setDevices(prev => prev.filter(d => d.id !== deviceId));
        }
      );
    } catch (e) {
      Alert.alert(t('common.error', '错误'), t('lan_transfer.scan_failed', '扫描失败'));
    } finally {
      setScanning(false);
    }
  }, [dbReady, lanSyncService, t]);

  const startServer = useCallback(async () => {
    if (!dbReady || !lanSyncService) return;
    try {
      const result = await lanSyncService.startBroadcasting();
      if (result) {
        setServerRunning(true);
        setServerPort(String(result.port));
      }
    } catch (e) {
      Alert.alert(t('common.error', '错误'), t('lan_transfer.server_start_failed', '启动服务器失败'));
    }
  }, [dbReady, lanSyncService, t]);

  const stopServer = useCallback(async () => {
    if (!lanSyncService) return;
    await lanSyncService.stopBroadcasting();
    setServerRunning(false);
  }, [lanSyncService]);

  const sendToDevice = useCallback(async (device: LanDevice) => {
    if (!lanSyncService) return;
    try {
      const success = await lanSyncService.sendFile(device.ip, device.port);
      Alert.alert(
        success ? t('common.success', '成功') : t('common.error', '错误'),
        success ? t('lan_transfer.send_success', '发送成功') : t('lan_transfer.send_failed', '发送失败')
      );
    } catch (e) {
      Alert.alert(t('common.error', '错误'), t('lan_transfer.send_failed', '发送失败'));
    }
  }, [lanSyncService, t]);

  return (
    <>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.bgApp} />
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.bgApp }]}>
        <View style={[styles.container, { backgroundColor: colors.bgApp }]}>
          {/* 头部 */}
          <View style={[styles.header, { backgroundColor: colors.bgSurface, borderBottomColor: colors.borderSubtle }]}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Text style={[styles.backText, { color: colors.primary }]}>← {t('common.back', '返回')}</Text>
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{t('lan_transfer.title', '局域网传输')}</Text>
            <TouchableOpacity onPress={startScan} disabled={scanning}>
              <Text style={[styles.scanButton, { color: scanning ? colors.textSecondary : colors.primary }]}>
                {scanning ? t('lan_transfer.scanning', '扫描中...') : t('lan_transfer.scan_devices', '扫描设备')}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} indicatorStyle="white">
            {/* 服务器状态 */}
            <View style={[styles.section, { backgroundColor: colors.bgSurface }]}>
              <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t('lan_transfer.server_status', '服务器状态')}</Text>
              
              <View style={styles.serverStatus}>
                <View style={styles.statusRow}>
                  <Text style={[styles.statusLabel, { color: colors.textPrimary }]}>{t('lan_transfer.status', '状态')}:</Text>
                  <View style={[
                    styles.statusIndicator, 
                    { backgroundColor: serverRunning ? colors.accentGreen : colors.error }
                  ]} />
                  <Text style={[styles.statusText, { color: colors.textPrimary }]}>
                    {serverRunning ? t('lan_transfer.running', '运行中') : t('lan_transfer.stopped', '已停止')}
                  </Text>
                </View>

                <View style={styles.portRow}>
                  <Text style={[styles.portLabel, { color: colors.textPrimary }]}>{t('lan_transfer.port', '端口')}:</Text>
                  <TextInput
                    style={[styles.portInput, { 
                      backgroundColor: colors.bgSurfaceHighest,
                      color: colors.textPrimary,
                      borderColor: colors.borderSubtle,
                    }]}
                    value={serverPort}
                    onChangeText={setServerPort}
                    placeholder="8080"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="numeric"
                    editable={!serverRunning}
                  />
                </View>

                <TouchableOpacity 
                  style={[
                    styles.serverButton, 
                    { backgroundColor: serverRunning ? colors.error : colors.primary }
                  ]}
                  onPress={serverRunning ? stopServer : startServer}
                >
                  <Text style={[styles.serverButtonText, { color: '#FFF' }]}>
                    {serverRunning ? t('lan_transfer.stop_server', '停止服务器') : t('lan_transfer.start_server', '启动服务器')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* 设备列表 */}
            <View style={[styles.section, { backgroundColor: colors.bgSurface }]}>
              <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t('lan_transfer.discovered_devices', '发现的设备')}</Text>
              
              {devices.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyIcon}>📡</Text>
                  <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{t('lan_transfer.no_devices', '暂未发现设备')}</Text>
                  <Text style={[styles.emptySubText, { color: colors.textSecondary }]}>
                    {scanning ? t('lan_transfer.scanning_hint', '正在扫描局域网设备...') : t('lan_transfer.scan_hint', '点击右上角扫描按钮搜索设备')}
                  </Text>
                </View>
              ) : (
                devices.map(device => (
                  <View key={device.id} style={[styles.deviceItem, { backgroundColor: colors.bgSurfaceHighest }]}>
                    <View style={styles.deviceInfo}>
                      <View style={styles.deviceHeader}>
                        <Text style={[styles.deviceName, { color: colors.textPrimary }]}>{device.name}</Text>
                        <View style={[
                          styles.onlineIndicator, 
                          { backgroundColor: device.isOnline ? colors.accentGreen : colors.error }
                        ]} />
                      </View>
                      <Text style={[styles.deviceIp, { color: colors.textSecondary }]}>
                        {device.ip}:{device.port}
                      </Text>
                    </View>

                    <View style={styles.deviceActions}>
                      <TouchableOpacity 
                        style={[styles.actionButton, { backgroundColor: colors.primary + '20' }]}
                        onPress={() => sendToDevice(device)}
                        disabled={!device.isOnline}
                      >
                        <Text style={[styles.actionText, { color: colors.primary }]}>{t('lan_transfer.send', '发送')}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </View>

            {/* 传输记录 */}
            <View style={[styles.section, { backgroundColor: colors.bgSurface }]}>
              <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t('lan_transfer.transfer_history', '传输记录')}</Text>
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyIcon}>📋</Text>
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{t('lan_transfer.no_history', '暂无传输记录')}</Text>
              </View>
            </View>
          </ScrollView>
        </View>
      </SafeAreaView>
    </>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
  },
  backText: {
    fontSize: 16,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  scanButton: {
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  serverStatus: {
    gap: 12,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 16,
  },
  portRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  portLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  portInput: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
  },
  serverButton: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  serverButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 24,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  emptySubText: {
    fontSize: 14,
    textAlign: 'center',
  },
  deviceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  deviceInfo: {
    flex: 1,
  },
  deviceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  deviceName: {
    fontSize: 16,
    fontWeight: '600',
  },
  onlineIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  deviceIp: {
    fontSize: 14,
  },
  deviceActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
