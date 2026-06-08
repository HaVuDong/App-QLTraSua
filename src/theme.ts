import { Platform, type TextStyle } from 'react-native';

export const COLORS = {
  primary: '#10B981',
  primaryLight: '#34D399',

  secondary: '#F59E0B',
  secondaryLight: '#FBBF24',

  accent: '#A855F7',
  accentLight: '#C084FC',

  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',

  background: '#050508',

  surface: 'rgba(20,20,30,0.75)',
  surfaceLight: 'rgba(255,255,255,0.08)',
  surfaceCard: '#12121E',

  text: '#F8FAFC',
  textMuted: '#94A3B8',
  textSoft: '#CBD5E1',

  border: 'rgba(255,255,255,0.08)',
  glowGreen: 'rgba(16,185,129,0.18)',
  glowPurple: 'rgba(168,85,247,0.18)',
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
};

export const SIZES = {
  radiusSm: 12,
  radiusMd: 16,
  radiusLg: 20,
  radiusXl: 24,
  buttonHeight: 52,
  inputHeight: 52,
  iconSm: 16,
  iconMd: 20,
  iconLg: 24,
  iconXl: 28,
};

type TypographyToken = Pick<TextStyle, 'fontSize' | 'fontWeight'>;

export const TYPOGRAPHY: Record<'hero' | 'title' | 'subtitle' | 'body' | 'caption' | 'tiny', TypographyToken> = {
  hero: { fontSize: 32, fontWeight: '800' },
  title: { fontSize: 24, fontWeight: '700' },
  subtitle: { fontSize: 18, fontWeight: '600' },
  body: { fontSize: 16, fontWeight: '500' },
  caption: { fontSize: 14, fontWeight: '400' },
  tiny: { fontSize: 12, fontWeight: '400' },
};

export const SHADOWS = {
  card:
    Platform.OS === 'web'
      ? {}
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.5,
          shadowRadius: 20,
          elevation: 6,
        },
  glowGreen:
    Platform.OS === 'web'
      ? {}
      : {
          shadowColor: COLORS.glowGreen,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 1,
          shadowRadius: 18,
          elevation: 8,
        },
  glowPurple:
    Platform.OS === 'web'
      ? {}
      : {
          shadowColor: COLORS.glowPurple,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 1,
          shadowRadius: 18,
          elevation: 8,
        },
};
