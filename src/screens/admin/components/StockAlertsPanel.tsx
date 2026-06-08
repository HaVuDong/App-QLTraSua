import { StyleSheet, Text, View } from 'react-native';

export type StockAlertItem = {
  _id?: string;
  name?: string;
  stock?: number;
  minStockLevel?: number;
  unit?: string;
};

type StockAlertsPanelProps = {
  alerts: StockAlertItem[];
  topItems: Array<{ itemId?: string; name?: string; count?: number; revenue?: number }>;
};

export function StockAlertsPanel({ alerts, topItems }: StockAlertsPanelProps) {
  const hasAlerts = alerts.length > 0;
  const visibleAlerts = alerts.slice(0, 4);
  const visibleTopItems = topItems.slice(0, 4);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{hasAlerts ? 'Cảnh báo kho' : 'Món bán chạy'}</Text>
      <Text style={styles.subtitle}>{hasAlerts ? `${alerts.length} nguyên liệu cần theo dõi` : 'Top món trong ngày'}</Text>

      <View style={styles.list}>
        {hasAlerts
          ? visibleAlerts.map((item, index) => (
              <View key={item._id || item.name || String(index)} style={styles.row}>
                <View style={styles.dotWarning} />
                <View style={styles.rowMain}>
                  <Text style={styles.itemName}>{item.name || 'Nguyên liệu'}</Text>
                  <Text style={styles.itemMeta}>
                    Tồn {item.stock ?? 0} {item.unit || ''} / ngưỡng {item.minStockLevel ?? 0}
                  </Text>
                </View>
              </View>
            ))
          : visibleTopItems.length
            ? visibleTopItems.map((item, index) => (
              <View key={item.itemId || item.name || String(index)} style={styles.row}>
                <View style={styles.dotInfo} />
                <View style={styles.rowMain}>
                  <Text style={styles.itemName}>{item.name || 'Món'}</Text>
                  <Text style={styles.itemMeta}>{item.count ?? 0} lượt bán</Text>
                </View>
              </View>
              ))
            : (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>Chưa có món bán trong ngày.</Text>
                </View>
              )}
      </View>
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
  title: {
    color: '#E2E8F0',
    fontSize: 16,
    fontWeight: '800',
  },
  subtitle: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 3,
    marginBottom: 16,
  },
  list: {
    rowGap: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 10,
  },
  dotWarning: {
    width: 9,
    height: 9,
    borderRadius: 999,
    backgroundColor: '#F59E0B',
  },
  dotInfo: {
    width: 9,
    height: 9,
    borderRadius: 999,
    backgroundColor: '#22D3EE',
  },
  rowMain: {
    flex: 1,
    minWidth: 0,
  },
  itemName: {
    color: '#CBD5E1',
    fontSize: 13,
    fontWeight: '800',
  },
  itemMeta: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 2,
  },
  emptyState: {
    minHeight: 72,
    justifyContent: 'center',
  },
  emptyText: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '700',
  },
});
