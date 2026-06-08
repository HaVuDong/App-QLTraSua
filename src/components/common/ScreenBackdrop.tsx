import { View } from 'react-native';
import { commonStyles } from '../../styles/commonStyles';

export function ScreenBackdrop() {
  return (
    <View style={[commonStyles.backgroundGradient, { pointerEvents: 'none' } as any]}>
      <View style={commonStyles.backgroundBase} />
      <View style={commonStyles.glowTopLeft} />
      <View style={commonStyles.glowBottomRight} />
    </View>
  );
}
