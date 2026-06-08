import { StyleSheet, View } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';

type MiniSparklineProps = {
  values: number[];
  color?: string;
};

export function MiniSparkline({ values, color = '#34D399' }: MiniSparklineProps) {
  const width = 70;
  const height = 30;
  const safeValues = values.length > 1 ? values : [0, values[0] ?? 0];
  const max = Math.max(...safeValues, 1);
  const min = Math.min(...safeValues, 0);
  const spread = Math.max(max - min, 1);
  const points = safeValues
    .map((value, index) => {
      const x = (index / (safeValues.length - 1)) * width;
      const y = height - ((value - min) / spread) * height;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <View style={styles.container}>
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <Polyline points={points} fill="none" stroke={color} strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 70,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
