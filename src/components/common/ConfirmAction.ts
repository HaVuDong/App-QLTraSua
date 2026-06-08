import { Alert, Platform } from 'react-native';

export type ConfirmActionOptions = {
  title: string;
  message: string;
  confirmText: string;
  cancelText?: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
};

export function runConfirmedAction({ title, message, confirmText, cancelText = 'Hủy', destructive, onConfirm }: ConfirmActionOptions) {
  if (Platform.OS === 'web') {
    const webConfirm = (globalThis as any).confirm;
    const accepted = typeof webConfirm === 'function' ? webConfirm(`${title}\n\n${message}`) : true;
    if (accepted) {
      void onConfirm();
    }
    return;
  }

  Alert.alert(title, message, [
    { text: cancelText, style: 'cancel' },
    {
      text: confirmText,
      style: destructive ? 'destructive' : 'default',
      onPress: () => {
        void onConfirm();
      },
    },
  ]);
}

