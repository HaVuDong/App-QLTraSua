import { StyleSheet, Text, View } from 'react-native';

export type RevenueHourPoint = {
  hour: number;
  revenue: number;
  orderCount: number;
};

type RevenueBarChartProps = {
  data: RevenueHourPoint[];
};

export function RevenueBarChart({ data }: RevenueBarChartProps) {
  const visibleData = data.length ? data : [];
  const maxRevenue = Math.max(...visibleData.map((point) => point.revenue), 1);
  const totalRevenue = visibleData.reduce((sum, point) => sum + point.revenue, 0);
  const totalOrders = visibleData.reduce((sum, point) => sum + point.orderCount, 0);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Doanh thu theo giờ</Text>
          <Text style={styles.subtitle}>Dữ liệu hôm nay từ báo cáo máy chủ</Text>
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{totalOrders} đơn</Text>
        </View>
      </View>

      <View style={styles.chart}>
        {visibleData.map((point) => {
          const height = Math.max((point.revenue / maxRevenue) * 120, point.revenue > 0 ? 10 : 3);
          const isPeak = point.revenue === maxRevenue && maxRevenue > 1;
          return (
            <View key={point.hour} style={styles.barColumn}>
              <View style={[styles.bar, isPeak ? styles.barPeak : null, { height }]} />
              <Text style={styles.hourLabel}>{point.hour}</Text>
            </View>
          );
        })}
      </View>

      <Text style={styles.footer}>Tổng: {totalRevenue.toLocaleString('vi-VN')} VND</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 0,
    borderRadius: 22,
    padding: 18,
    backgroundColor: 'rgba(15,23,42,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(99,102,241,0.18)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    columnGap: 12,
    marginBottom: 14,
  },
  title: {
    color: '#E2E8F0',
    fontSize: 16,
    fontWeight: '800',
  },
  subtitle: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 3,
  },
  badge: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(99,102,241,0.25)',
    backgroundColor: 'rgba(99,102,241,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgeText: {
    color: '#A5B4FC',
    fontSize: 11,
    fontWeight: '800',
  },
  chart: {
    height: 152,
    flexDirection: 'row',
    alignItems: 'flex-end',
    columnGap: 4,
  },
  barColumn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    rowGap: 6,
  },
  bar: {
    width: '100%',
    minWidth: 4,
    maxWidth: 18,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    backgroundColor: '#334155',
  },
  barPeak: {
    backgroundColor: '#6366F1',
  },
  hourLabel: {
    color: '#64748B',
    fontSize: 9,
  },
  footer: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 14,
  },
});
