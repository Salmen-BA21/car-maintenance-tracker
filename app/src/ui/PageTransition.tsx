import { useEffect, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, useWindowDimensions } from 'react-native';

import { pageMotionValues, type PageMotion } from './page-motion';

// Critically damped spring: no overshoot, settles in roughly Apple's 0.35s.
const SPRING = {
  damping: 32,
  mass: 1,
  overshootClamping: true,
  stiffness: 260,
  useNativeDriver: true,
} as const;

export function PageTransition({ motion, children }: { motion: PageMotion; children: ReactNode }) {
  const { width } = useWindowDimensions();
  // State, not a ref: the animated value is read while rendering the styles.
  const [progress] = useState(() => new Animated.Value(0));
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (active) setReduceMotion(enabled);
      })
      .catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      progress.setValue(1);
      return;
    }
    progress.setValue(0);
    const animation = Animated.spring(progress, { toValue: 1, ...SPRING });
    animation.start();
    return () => animation.stop();
  }, [progress, reduceMotion]);

  const { enterX, enterOpacity, enterScale } = pageMotionValues(motion, width);
  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [enterX, 0] });
  const opacity = progress.interpolate({ inputRange: [0, 1], outputRange: [enterOpacity, 1] });
  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [enterScale, 1] });

  return (
    <Animated.View style={{ flex: 1, opacity, transform: [{ translateX }, { scale }] }}>
      {children}
    </Animated.View>
  );
}
