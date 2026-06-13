import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../../auth/AuthContext';
import { ScreenBackdrop } from '../../components/common/ScreenBackdrop';
import { runConfirmedAction } from '../../components/common/ConfirmAction';
import { EmptyStateView, ErrorStateView, LoadingView, RestrictedStateView } from '../../components/StateViews';
import { KITCHEN_QUEUE_ROLES } from '../../constants/roles';
import { getKitchenQueue, updateOrderItemStatus, type KitchenQueueItem } from '../../services/order';
import { styles } from '../../styles/appStyles';
import { getOrderItemStatusLabel } from '../../utils/displayLabels';

type QueueFilter = 'PREPARING' | 'READY' | 'ALL';

export function KitchenScreen() {
  const { user, socketRef, socketReady } = useAuth();
  const [items, setItems] = useState<KitchenQueueItem[]>([]);
  const [screenLoading, setScreenLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [filter, setFilter] = useState<QueueFilter>('PREPARING');

  const fetchQueue = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setScreenLoading(true);
      }
      setLoadError('');
      const data = await getKitchenQueue();
      setItems(data);
    } catch (err: any) {
      setLoadError(err.response?.data?.message || 'Không thể tải hàng chờ bếp');
    } finally {
      setScreenLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchQueue();
  }, [fetchQueue]);

  useEffect(() => {
    if (!socketReady || !socketRef?.current) return;

    const socket = socketRef.current;
    const sync = () => void fetchQueue(true);

    socket.on('orderConfirmed', sync);
    socket.on('newQrOrder', sync);
    socket.on('itemStatusChanged', sync);
    socket.on('itemCancelled', sync);
    socket.on('orderCompleted', sync);
    socket.on('orderRejected', sync);

    return () => {
      socket.off('orderConfirmed', sync);
      socket.off('newQrOrder', sync);
      socket.off('itemStatusChanged', sync);
      socket.off('itemCancelled', sync);
      socket.off('orderCompleted', sync);
      socket.off('orderRejected', sync);
    };
  }, [fetchQueue, socketReady, socketRef]);

  const filteredItems = useMemo(() => {
    if (filter === 'ALL') return items;
    return items.filter((item) => item.status === filter);
  }, [filter, items]);

  const preparingCount = items.filter((item) => item.status === 'PREPARING').length;
  const readyCount = items.filter((item) => item.status === 'READY').length;

  const handleMarkReady = useCallback(
    (item: KitchenQueueItem) => {
      runConfirmedAction({
        title: 'Xác nhận món đã xong',
        message: `Chuyển ${item.quantity}x ${item.name} sang trạng thái đã xong?`,
        confirmText: 'Đã xong',
        onConfirm: async () => {
          try {
            await updateOrderItemStatus(item.orderId, item.orderItemId, 'READY');
            await fetchQueue(true);
          } catch (err: any) {
            Alert.alert('Lỗi', err.response?.data?.message || 'Không thể cập nhật món');
          }
        },
      });
    },
    [fetchQueue],
  );

  if (!user || !KITCHEN_QUEUE_ROLES.includes(user.role)) {
    return (
      <View style={styles.screenContainer}>
        <ScreenBackdrop />
        <RestrictedStateView message="Bạn không có quyền truy cập màn hình bếp." />
      </View>
    );
  }

  if (screenLoading) {
    return (
      <View style={styles.screenContainer}>
        <ScreenBackdrop />
        <LoadingView />
      </View>
    );
  }

  return (
    <View style={styles.screenContainer}>
      <ScreenBackdrop />
      <ScrollView
        style={styles.screenScroll}
        contentContainerStyle={styles.screenContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void fetchQueue(true)} />}
      >
        <View style={styles.screenStack}>
          <Text style={styles.sectionTitle}>Màn hình bếp</Text>

          <View style={styles.filterRow}>
            {[
              { key: 'PREPARING' as const, label: `Đang làm (${preparingCount})` },
              { key: 'READY' as const, label: `Đã xong (${readyCount})` },
              { key: 'ALL' as const, label: `Tất cả (${items.length})` },
            ].map((option) => {
              const selected = filter === option.key;
              return (
                <TouchableOpacity
                  key={option.key}
                  activeOpacity={0.8}
                  style={[styles.filterChip, selected ? styles.filterChipActive : null]}
                  onPress={() => setFilter(option.key)}
                >
                  <Text style={[styles.filterChipText, selected ? styles.filterChipTextActive : null]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {loadError ? <ErrorStateView message={loadError} onRetry={() => void fetchQueue()} /> : null}

          {!loadError && filteredItems.length === 0 ? (
            <EmptyStateView message="Không có món nào trong hàng chờ." />
          ) : (
            filteredItems.map((item) => (
              <View key={`${item.orderId}-${item.orderItemId}`} style={[styles.glassCard, styles.kitchenCard]}>
                <View style={styles.orderHeader}>
                  <Text style={styles.kitchenTableText}>{item.tableName || 'Mang đi'}</Text>
                  <View style={[styles.statusBadge, item.status === 'READY' ? styles.statusProgress : styles.statusPending]}>
                    <Text style={styles.statusText}>{getOrderItemStatusLabel(item.status)}</Text>
                  </View>
                </View>
                <Text style={styles.kitchenItemText}>{item.quantity}x {item.name}</Text>
                <Text style={styles.staffMeta}>Đơn #{item.orderCode || item.orderId.slice(-6).toUpperCase()}</Text>
                {item.note ? <Text style={styles.kitchenNote}>Ghi chú: {item.note}</Text> : null}
                {item.status === 'PREPARING' ? (
                  <TouchableOpacity
                    activeOpacity={0.8}
                    style={[styles.buttonBase, styles.buttonPrimary]}
                    onPress={() => handleMarkReady(item)}
                  >
                    <Text style={styles.buttonText}>Đã làm xong</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}
