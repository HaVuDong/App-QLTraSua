import React from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { COLORS, SPACING, TYPOGRAPHY } from '../theme';

type EmptyStateProps = {
  message: string;
};

export function EmptyStateView({ message }: EmptyStateProps) {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: SPACING.xxxl }}>
      <Text style={{ ...TYPOGRAPHY.body, color: COLORS.textMuted, textAlign: 'center' }}>{message}</Text>
    </View>
  );
}

type ErrorStateProps = {
  message: string;
  onRetry?: () => void;
};

export function ErrorStateView({ message, onRetry }: ErrorStateProps) {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: SPACING.xxxl, rowGap: SPACING.md }}>
      <Text style={{ ...TYPOGRAPHY.body, color: COLORS.error, textAlign: 'center' }}>{message}</Text>
      {onRetry ? (
        <TouchableOpacity
          onPress={onRetry}
          style={{
            paddingHorizontal: SPACING.lg,
            paddingVertical: SPACING.sm,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: COLORS.border,
            backgroundColor: COLORS.surfaceLight,
          }}
        >
          <Text style={{ ...TYPOGRAPHY.caption, color: COLORS.text }}>Thu lai</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export function LoadingView() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator size="large" color={COLORS.primary} />
    </View>
  );
}

type RestrictedStateProps = {
  message: string;
  actionText?: string;
  onAction?: () => void;
};

export function RestrictedStateView({ message, actionText, onAction }: RestrictedStateProps) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SPACING.xl, rowGap: SPACING.md }}>
      <Text style={{ ...TYPOGRAPHY.subtitle, color: COLORS.text, textAlign: 'center' }}>{message}</Text>
      {actionText && onAction ? (
        <TouchableOpacity
          onPress={onAction}
          style={{
            paddingHorizontal: SPACING.lg,
            paddingVertical: SPACING.sm,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: COLORS.border,
            backgroundColor: COLORS.surfaceLight,
          }}
        >
          <Text style={{ ...TYPOGRAPHY.caption, color: COLORS.text }}>{actionText}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}
