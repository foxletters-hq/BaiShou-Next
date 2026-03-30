import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';

export const OnboardingScreen = () => {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.logoBox}>
          <Text style={styles.logoText}>✨</Text>
        </View>
        <Text style={styles.title}>欢迎来到</Text>
        <Text style={styles.brand}>BaiShou Next</Text>
        <Text style={styles.subtitle}>强大的 Agent 网络系统，为你提供智能且高效的移动端响应。</Text>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity 
          style={styles.btn}
          onPress={() => router.replace('/(tabs)/agent')}
        >
          <Text style={styles.btnText}>开始体验</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  logoBox: {
    width: 80,
    height: 80,
    backgroundColor: '#E3F2FD',
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  logoText: {
    fontSize: 40,
  },
  title: {
    fontSize: 24,
    color: '#666',
    marginBottom: 8,
  },
  brand: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
  },
  footer: {
    padding: 24,
  },
  btn: {
    backgroundColor: '#5BA8F5',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  btnText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  }
});
