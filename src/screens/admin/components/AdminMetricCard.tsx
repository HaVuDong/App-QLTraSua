import { StyleSheet, Text, View } from 'react-native';
import { MiniSparkline } from './MiniSparkline';

type AdminMetricCardProps = {
  label: string;
  value: string | number;
  subLabel?: string;
  accentColor?: string;
  sparklineValues?: number[];
  width: number | `${number}%`;
};

export function AdminMetricCard({ label, value, subLabel, accentColor = '#6366F1', sparklineValues = [], width }: AdminMetricCardProps) {
  return (
    <View style={[styles.card, { width }]}>
      <View style={styles.header}>
        <Text style={styles.label}>{label}</Text>
        {sparklineValues.length ? <MiniSparkline values={sparklineValues} color={accentColor} /> : null}
      </View>
      <Text style={styles.value}>{value}</Text>
      {subLabel ? <Text style={styles.subLabel}>{subLabel}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 132,
    borderRadius: 22,
    padding: 16,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  header: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    columnGap: 10,
    marginBottom: 12,
  },
  label: {
    flex: 1,
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
  },
  value: {
    color: '#F8FAFC',
    fontSize: 24,
    fontWeight: '800',
  },
  subLabel: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
  },
});
