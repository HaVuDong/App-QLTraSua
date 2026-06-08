import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { ActiveOrder } from '../../../services/order';
import { formatCurrencyVnd } from '../../../utils/format';

type ActiveOrdersPanelProps = {
  orders: ActiveOrder[];
  onViewAll: () => void;
};

function getTableLabel(order: ActiveOrder) {
  if (typeof order.tableId === 'object') return order.tableId?.name || 'Bàn';
  return 'Bàn';
}

function getOrderStatusLabel(status?: string) {
  if (status === 'PENDING') return 'Chờ xác nhận';
  if (status === 'IN_PROGRESS') return 'Đang xử lý';
  if (status === 'COMPLETED') return 'Hoàn thành';
  if (status === 'CANCELLED') return 'Đã hủy';
  return status || '-';
}

export function ActiveOrdersPanel({ orders, onViewAll }: ActiveOrdersPanelProps) {
  const visibleOrders = orders.slice(0, 5);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Đơn cần xử lý</Text>
          <Text style={styles.subtitle}>{orders.length} đơn đang mở</Text>
        </View>
        <TouchableOpacity activeOpacity={0.8} onPress={onViewAll} style={styles.linkButton}>
          <Text style={styles.linkText}>Xem tất cả</Text>
        </TouchableOpacity>
      </View>

      {visibleOrders.length ? (
        <View style={styles.list}>
          {visibleOrders.map((order) => (
            <View key={order._id} style={styles.orderRow}>
              <View style={styles.orderMain}>
                <Text style={styles.orderCode}>#{order._id.slice(-6).toUpperCase()}</Text>
                <Text style={styles.orderMeta}>
                  {getTableLabel(order)} - {order.items.length} món
                </Text>
              </View>
              <View style={styles.orderRight}>
                <Text style={styles.orderAmount}>{formatCurrencyVnd(order.finalAmount ?? order.totalAmount ?? 0)}</Text>
                <Text style={styles.orderStatus}>{getOrderStatusLabel(order.status)}</Text>
              </View>
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Chưa có đơn đang xử lý.</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: 'rgba(15,23,42,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(99,102,241,0.18)',
  },
  header: {
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(30,41,59,0.8)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: 12,
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
  linkButton: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(99,102,241,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(99,102,241,0.24)',
  },
  linkText: {
    color: '#A5B4FC',
    fontSize: 11,
    fontWeight: '800',
  },
  list: {
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  orderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(30,41,59,0.5)',
  },
  orderMain: {
    flex: 1,
    minWidth: 0,
  },
  orderCode: {
    color: '#818CF8',
    fontSize: 12,
    fontWeight: '900',
  },
  orderMeta: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 3,
  },
  orderRight: {
    alignItems: 'flex-end',
  },
  orderAmount: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '800',
  },
  orderStatus: {
    color: '#FBBF24',
    fontSize: 10,
    fontWeight: '800',
    marginTop: 3,
  },
  emptyState: {
    padding: 20,
  },
  emptyText: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '700',
  },
});
