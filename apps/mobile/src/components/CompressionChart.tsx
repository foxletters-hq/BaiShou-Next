import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';
import { useNativeTheme } from '@baishou/ui/native';

interface CompressionChartProps {
  delay?: number;
}

export const CompressionChart: React.FC<CompressionChartProps> = ({ delay = 0 }) => {
  const { colors } = useNativeTheme();
  const screenWidth = Dimensions.get('window').width;
  const maxWidth = Math.min(screenWidth - 40, 420);

  const anim1 = useRef(new Animated.Value(0)).current;
  const anim2 = useRef(new Animated.Value(0)).current;
  const anim3 = useRef(new Animated.Value(0)).current;
  const anim4 = useRef(new Animated.Value(0)).current;
  const anim5 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animations = [
      Animated.timing(anim1, { toValue: 1, duration: 800, delay: delay + 0, useNativeDriver: true }),
      Animated.timing(anim2, { toValue: 1, duration: 800, delay: delay + 150, useNativeDriver: true }),
      Animated.timing(anim3, { toValue: 1, duration: 800, delay: delay + 300, useNativeDriver: true }),
      Animated.timing(anim4, { toValue: 1, duration: 800, delay: delay + 450, useNativeDriver: true }),
      Animated.timing(anim5, { toValue: 1, duration: 800, delay: delay + 600, useNativeDriver: true }),
    ];

    Animated.stagger(100, animations).start();
  }, [delay, anim1, anim2, anim3, anim4, anim5]);

  const createStepStyle = (anim: Animated.Value, widthFactor: number, color: string) => ({
    opacity: anim,
    transform: [{
      translateY: anim.interpolate({
        inputRange: [0, 1],
        outputRange: [10, 0],
      })
    }],
    width: maxWidth * widthFactor,
    backgroundColor: color,
  });

  return (
    <View style={styles.container}>
      {/* 日 */}
      <Animated.View style={[styles.step, createStepStyle(anim1, 0.30, '#B3E5FC')]}>
        <Text style={styles.stepText}>日</Text>
      </Animated.View>

      {/* 周 */}
      <Animated.View style={[styles.step, createStepStyle(anim2, 0.48, '#81D4FA')]}>
        <Text style={styles.stepText}>周</Text>
      </Animated.View>

      {/* 月 */}
      <Animated.View style={[styles.step, createStepStyle(anim3, 0.66, '#4FC3F7')]}>
        <Text style={styles.stepText}>月</Text>
      </Animated.View>

      {/* 季 */}
      <Animated.View style={[styles.step, createStepStyle(anim4, 0.82, '#29B6F6')]}>
        <Text style={styles.stepText}>季</Text>
      </Animated.View>

      {/* 年基底 */}
      <Animated.View style={[styles.baseBar, {
        opacity: anim5,
        transform: [{
          translateY: anim5.interpolate({
            inputRange: [0, 1],
            outputRange: [14, 0],
          })
        }],
        width: maxWidth,
      }]}>
        <Text style={styles.baseBarText}>年</Text>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'flex-start',
  },
  step: {
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  stepText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 14,
    letterSpacing: 0.5,
  },
  baseBar: {
    height: 46,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 6,
    backgroundColor: '#64B5F6',
    shadowColor: '#9AD4EA',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  baseBarText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 17,
    letterSpacing: 3,
  },
});