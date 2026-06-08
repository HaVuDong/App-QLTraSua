import { StyleSheet } from 'react-native';
import { COLORS } from '../theme';

export const commonStyles = StyleSheet.create({
  backgroundGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  backgroundBase: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.background,
  },
  glowTopLeft: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: 'rgba(16,185,129,0.12)',
    top: -80,
    left: -40,
  },
  glowBottomRight: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(168,85,247,0.12)',
    bottom: -120,
    right: -60,
  },
});
