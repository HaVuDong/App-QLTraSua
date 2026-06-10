import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../../auth/AuthContext';
import { ScreenBackdrop } from '../../components/common/ScreenBackdrop';
import { runConfirmedAction } from '../../components/common/ConfirmAction';
import { EmptyStateView, ErrorStateView, LoadingView, RestrictedStateView } from '../../components/StateViews';
import { API_BASE_URL } from '../../config/api';
import { ORDER_ROLES } from '../../constants/roles';
import { getMenuAvailability, getMenuItems, checkMenuItemAvailability, type MenuAvailabilityResult, type MenuItem } from '../../services/menu';
import { checkoutOrder, confirmOrder, createStaffOrder, getActiveOrders, rejectOrder, updateOrderItemStatus, type ActiveOrder, type CreateOrderItemInput } from '../../services/order';
import { getTables, type DiningTable } from '../../services/table';
import { styles } from '../../styles/appStyles';
import { COLORS } from '../../theme';
import { getInventoryCategoryLabel, getOrderItemStatusLabel, getOrderStatusLabel } from '../../utils/displayLabels';
export function OrderScreen() {
  const { user, socketRef, socketReady } = useAuth();
  const [orders, setOrders] = useState<ActiveOrder[]>([]);
  const [screenLoading, setScreenLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [showCreateOrderForm, setShowCreateOrderForm] = useState(false);
  const [orderFormLoading, setOrderFormLoading] = useState(false);
  const [orderFormError, setOrderFormError] = useState('');
  const [orderSubmitting, setOrderSubmitting] = useState(false);
  const [selectedTableId, setSelectedTableId] = useState('');
  const [orderNote, setOrderNote] = useState('');
  const [tableOptions, setTableOptions] = useState<DiningTable[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [menuAvailabilityMap, setMenuAvailabilityMap] = useState<Record<string, MenuAvailabilityResult>>({});
  const [draftItems, setDraftItems] = useState<CreateOrderItemInput[]>([]);
  const [menuSearch, setMenuSearch] = useState('');
  const [itemWarnings, setItemWarnings] = useState<string[]>([]);

  const canCreateStaffOrder = user?.role === 'ADMIN' || user?.role === 'MANAGER' || user?.role === 'USER';
  const tenantId = user?.tenantId || '';

  const getOrderItemId = useCallback((item: any) => {
    if (!item) return '';
    if (typeof item.itemId === 'string') return item.itemId;
    return item.itemId?._id || item._id || '';
  }, []);

  const getAvailabilityMeta = useCallback(
    (item: MenuItem) => {
      const availability = menuAvailabilityMap[item._id];
      const isActive = item.status === 'ACTIVE';
      const isAvailable = isActive && Boolean(availability?.available);
      const reason = availability?.reason || (isActive ? '' : 'MON_DANG_TAM_NGUNG');

      let statusLabel = 'Đang bán';
      if (!isActive) statusLabel = 'Tạm ngưng';
      else if (!availability?.available) statusLabel = 'Hết món';

      let warning = '';
      if (reason === 'RECIPE_MISSING') {
        warning = 'Món này chưa có công thức nguyên liệu';
      } else if (reason === 'INSUFFICIENT_INGREDIENTS') {
        warning = 'Không đủ nguyên liệu để tạo đơn';
      } else if (reason === 'INGREDIENT_UNAVAILABLE') {
        warning = 'Nguyên liệu hiện tại không khả dụng';
      } else if (reason === 'MON_DANG_TAM_NGUNG') {
        warning = 'Món đang tạm ngưng';
      }

      return {
        isAvailable,
        statusLabel,
        warning,
        issues: availability?.issues || [],
      };
    },
    [menuAvailabilityMap],
  );

  const getTableStatusLabel = useCallback((status?: string) => {
    if (status === 'SERVING') return 'Đang hoạt động';
    if (status === 'PAYING') return 'Đang thanh toán';
    if (status === 'CLEANING') return 'Đang dọn dẹp';
    return 'Còn trống';
  }, []);

  const mapOrderErrorMessage = useCallback((err: any, fallback: string) => {
    const code = err?.response?.data?.code;
    if (code === 'MISSING_MENU_RECIPE') return 'Món này chưa có công thức nguyên liệu';
    if (code === 'MENU_ITEM_NOT_LINKED') return 'Món này chưa được liên kết menu';
    if (code === 'INSUFFICIENT_INGREDIENT_STOCK') return 'Không đủ nguyên liệu để tạo đơn';
    return err?.response?.data?.message || fallback;
  }, []);

  const fetchActiveOrders = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setScreenLoading(true);
      }
      setLoadError('');
      const data = await getActiveOrders();
      setOrders(data);
    } catch (err: any) {
      setLoadError(err.response?.data?.message || 'Không thể tải danh sách đơn hàng');
    } finally {
      setScreenLoading(false);
      setRefreshing(false);
    }
  }, []);

  const fetchOrderFormResources = useCallback(async () => {
    try {
      setOrderFormLoading(true);
      setOrderFormError('');
      const [tables, items, availabilityRows] = await Promise.all([getTables(), getMenuItems(), getMenuAvailability()]);
      const visibleTables = tables.filter((table) => !table.isHidden);
      const nextAvailabilityMap: Record<string, MenuAvailabilityResult> = {};
      availabilityRows.forEach((row) => {
        nextAvailabilityMap[row.menuItemId] = row;
      });
      setTableOptions(visibleTables);
      setMenuItems(items);
      setMenuAvailabilityMap(nextAvailabilityMap);
    } catch (err: any) {
      setOrderFormError(err.response?.data?.message || 'Không thể tải menu/bàn cho tạo đơn');
    } finally {
      setOrderFormLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchActiveOrders();
  }, [fetchActiveOrders]);

  useEffect(() => {
    if (!socketReady || !socketRef?.current) return;

    const socket = socketRef.current;

    const handleNewOrder = (newOrder: any) => setOrders((prev) => [newOrder, ...prev]);
    const handleOrderConfirmed = (confirmedOrder: any) => {
      setOrders((prev) => {
        const exists = prev.find((o) => o._id === confirmedOrder._id);
        if (exists) {
          return prev.map((o) => (o._id === confirmedOrder._id ? confirmedOrder : o));
        }
        return [confirmedOrder, ...prev];
      });
    };

    const handleItemStatusChanged = (data: any) => {
      setOrders((prev) =>
        prev.map((o) => {
          if (o._id !== data.orderId) return o;
          return {
            ...o,
            items: o.items.map((item: any) => {
              const candidateId = item.itemId?._id || item.itemId || item._id;
              if (candidateId === data.itemId) {
                return { ...item, status: data.status };
              }
              return item;
            }),
          };
        }),
      );
    };

    const handleOrderCompleted = (order: any) => setOrders((prev) => prev.filter((o) => o._id !== order._id));
    const handleOrderRejected = (order: any) => setOrders((prev) => prev.filter((o) => o._id !== order._id));

    socket.on('newQrOrder', handleNewOrder);
    socket.on('orderConfirmed', handleOrderConfirmed);
    socket.on('itemStatusChanged', handleItemStatusChanged);
    socket.on('orderCompleted', handleOrderCompleted);
    socket.on('orderRejected', handleOrderRejected);

    return () => {
      socket.off('newQrOrder', handleNewOrder);
      socket.off('orderConfirmed', handleOrderConfirmed);
      socket.off('itemStatusChanged', handleItemStatusChanged);
      socket.off('orderCompleted', handleOrderCompleted);
      socket.off('orderRejected', handleOrderRejected);
    };
  }, [socketReady, socketRef]);

  const syncAfterAction = useCallback(() => {
    void fetchActiveOrders(true);
  }, [fetchActiveOrders]);

  const handleUpdateItemStatus = useCallback(
    (orderId: string, itemId: string, status: 'READY' | 'PREPARING' | 'PENDING' | 'CANCELLED') => {
      runConfirmedAction({
        title: 'Xác nhận',
        message: 'Bạn muốn cập nhật trạng thái món này?',
        confirmText: 'Đồng ý',
        onConfirm: async () => {
          try {
            await updateOrderItemStatus(orderId, itemId, status);
            syncAfterAction();
          } catch (err: any) {
            Alert.alert('Lỗi', err.response?.data?.message || 'Có lỗi xảy ra');
          }
        },
      });
    },
    [syncAfterAction],
  );

  const validateOrderAgainstLatestStock = useCallback(
    async (order: ActiveOrder) => {
      const totalByMenuItemId = new Map<string, number>();
      (order.items || [])
        .filter((item: any) => item.status !== 'CANCELLED')
        .forEach((item: any) => {
          const menuItemId = getOrderItemId(item);
          const quantity = Number(item.quantity || 0);
          if (!menuItemId || !Number.isFinite(quantity) || quantity <= 0) return;
          totalByMenuItemId.set(menuItemId, (totalByMenuItemId.get(menuItemId) || 0) + quantity);
        });

      const issues: string[] = [];
      for (const [menuItemId, quantity] of totalByMenuItemId.entries()) {
        try {
          const availability = await checkMenuItemAvailability(menuItemId, quantity);
          if (!availability.available) {
            if (availability.reason === 'RECIPE_MISSING') {
              issues.push(`${availability.name}: Món này chưa có công thức nguyên liệu`);
            } else if (availability.reason === 'INSUFFICIENT_INGREDIENTS') {
              issues.push(`${availability.name}: Không đủ nguyên liệu để tạo đơn`);
            } else {
              issues.push(`${availability.name}: Hết món`);
            }
          }
        } catch (err: any) {
          const code = err?.response?.data?.code;
          if (code === 'MISSING_MENU_RECIPE') {
            issues.push('Món này chưa có công thức nguyên liệu');
            continue;
          }
          if (code === 'INSUFFICIENT_INGREDIENT_STOCK') {
            issues.push('Không đủ nguyên liệu để tạo đơn');
            continue;
          }
          if (code === 'MENU_ITEM_NOT_LINKED') {
            issues.push('Món này chưa được liên kết menu');
            continue;
          }
          // Compatibility fallback for old order records: let backend decide on confirm/checkout.
          continue;
        }
      }

      if (issues.length > 0) {
        Alert.alert('Không thể xử lý đơn', issues.join('\n'));
        return false;
      }
      return true;
    },
    [getOrderItemId],
  );

  const handleConfirmOrder = useCallback(
    (order: ActiveOrder) => {
      runConfirmedAction({
        title: 'Xác nhận đơn',
        message: 'Bạn chắc chắn muốn xác nhận đơn này?',
        confirmText: 'Xác nhận',
        onConfirm: async () => {
          try {
            const canContinue = await validateOrderAgainstLatestStock(order);
            if (!canContinue) return;
            await confirmOrder(order._id);
            syncAfterAction();
          } catch (err: any) {
            Alert.alert('Lỗi', mapOrderErrorMessage(err, 'Có lỗi xảy ra'));
          }
        },
      });
    },
    [mapOrderErrorMessage, syncAfterAction, validateOrderAgainstLatestStock],
  );

  const handleRejectOrder = useCallback(
    (orderId: string) => {
      runConfirmedAction({
        title: 'Từ chối đơn',
        message: 'Bạn chắc chắn muốn từ chối đơn này?',
        confirmText: 'Từ chối',
        destructive: true,
        onConfirm: async () => {
          try {
            await rejectOrder(orderId, 'Từ chối bởi nhân viên');
            syncAfterAction();
          } catch (err: any) {
            Alert.alert('Lỗi', err.response?.data?.message || 'Không thể từ chối đơn');
          }
        },
      });
    },
    [syncAfterAction],
  );

  const handleCheckout = useCallback(
    (order: ActiveOrder) => {
      runConfirmedAction({
        title: 'Thanh toán',
        message: 'Xác nhận thanh toán đơn hàng này?',
        confirmText: 'Thanh toán',
        onConfirm: async () => {
          try {
            const canContinue = await validateOrderAgainstLatestStock(order);
            if (!canContinue) return;
            await checkoutOrder(order._id, 0, 'FLAT');
            syncAfterAction();
            Alert.alert('Thành công', 'Tạo đơn thành công và đã cập nhật trạng thái đơn.');
          } catch (err: any) {
            Alert.alert('Lỗi', mapOrderErrorMessage(err, 'Tạo đơn thất bại'));
          }
        },
      });
    },
    [mapOrderErrorMessage, syncAfterAction, validateOrderAgainstLatestStock],
  );

  const openCreateOrderForm = useCallback(() => {
    setShowCreateOrderForm(true);
    setOrderNote('');
    setSelectedTableId('');
    setDraftItems([]);
    setMenuSearch('');
    setItemWarnings([]);
    void fetchOrderFormResources();
  }, [fetchOrderFormResources]);

  const closeCreateOrderForm = useCallback(() => {
    setShowCreateOrderForm(false);
    setOrderFormError('');
    setOrderNote('');
    setSelectedTableId('');
    setDraftItems([]);
    setMenuSearch('');
    setItemWarnings([]);
  }, []);

  const updateDraftItemQuantity = useCallback(
    (item: MenuItem, nextQuantity: number) => {
      const availabilityMeta = getAvailabilityMeta(item);
      if (!availabilityMeta.isAvailable) {
        Alert.alert('Hết món', availabilityMeta.warning || `${item.name} đang hết hàng hoặc tạm ngưng bán.`);
        return;
      }

      if (nextQuantity <= 0) {
        setDraftItems((prev) => prev.filter((entry) => entry.menuItemId !== item._id));
        return;
      }

      setDraftItems((prev) => {
        const existing = prev.find((entry) => entry.menuItemId === item._id);
        if (existing) {
          return prev.map((entry) => (entry.menuItemId === item._id ? { ...entry, quantity: nextQuantity } : entry));
        }
        return [...prev, { menuItemId: item._id, quantity: nextQuantity }];
      });
    },
    [getAvailabilityMeta],
  );

  const handleSubmitCreateOrder = useCallback(async () => {
    if (!selectedTableId) {
      setOrderFormError('Bàn là bắt buộc');
      return;
    }
    if (draftItems.length === 0) {
      setOrderFormError('Không thể thêm vào giỏ hàng: chưa chọn món');
      return;
    }

    setOrderSubmitting(true);
    setOrderFormError('');
    setItemWarnings([]);

    try {
      const totalByMenuItemId = new Map<string, number>();
      draftItems.forEach((entry) => {
        const menuItemId = String(entry.menuItemId || '').trim();
        const quantity = Number(entry.quantity || 0);
        if (!menuItemId || !Number.isFinite(quantity) || quantity <= 0) return;
        totalByMenuItemId.set(menuItemId, (totalByMenuItemId.get(menuItemId) || 0) + quantity);
      });

      const issues: string[] = [];
      for (const [menuItemId, quantity] of totalByMenuItemId.entries()) {
        const menuItem = menuItems.find((item) => item._id === menuItemId);
        try {
          const availability = await checkMenuItemAvailability(menuItemId, quantity);
          if (!availability.available) {
            if (availability.reason === 'RECIPE_MISSING') {
              issues.push(`${availability.name}: Món này chưa có công thức nguyên liệu`);
            } else if (availability.reason === 'INSUFFICIENT_INGREDIENTS') {
              issues.push(`${availability.name}: Không đủ nguyên liệu để tạo đơn`);
            } else {
              issues.push(`${availability.name}: Hết món`);
            }
          }
        } catch (err: any) {
          const code = err?.response?.data?.code;
          if (code === 'MISSING_MENU_RECIPE') {
            issues.push(`${menuItem?.name || 'Món này'}: Món này chưa có công thức nguyên liệu`);
            continue;
          }
          if (code === 'MENU_ITEM_NOT_LINKED') {
            issues.push(`${menuItem?.name || 'Món này'}: Món này chưa được liên kết menu`);
            continue;
          }
          if (code === 'INSUFFICIENT_INGREDIENT_STOCK') {
            issues.push(`${menuItem?.name || 'Món này'}: Không đủ nguyên liệu để tạo đơn`);
            continue;
          }
          issues.push(`${menuItem?.name || 'Món này'}: Không thể kiểm tra khả dụng món`);
        }
      }

      if (issues.length > 0) {
        setItemWarnings(issues);
        setOrderFormError('Không thể tạo đơn vì hết hàng');
        return;
      }

      await createStaffOrder({
        tableId: selectedTableId,
        items: draftItems.map((entry) => ({
          menuItemId: String(entry.menuItemId || ''),
          quantity: Number(entry.quantity || 0),
          note: entry.note,
        })),
        orderNote: orderNote.trim() || undefined,
      });

      Alert.alert('Thành công', 'Tạo đơn thành công');
      closeCreateOrderForm();
      await fetchOrderFormResources();
      void fetchActiveOrders(true);
    } catch (err: any) {
      const backendMessage = mapOrderErrorMessage(err, 'Tạo đơn thất bại');
      setOrderFormError(backendMessage);
      Alert.alert('Tạo đơn thất bại', backendMessage);
    } finally {
      setOrderSubmitting(false);
    }
  }, [closeCreateOrderForm, draftItems, fetchActiveOrders, fetchOrderFormResources, mapOrderErrorMessage, menuItems, orderNote, selectedTableId]);

  if (!user || !ORDER_ROLES.includes(user.role)) {
    return (
      <View style={styles.screenContainer}>
        <ScreenBackdrop />
        <RestrictedStateView message="Bạn không có quyền truy cập màn hình đơn hàng." />
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

  if (user.role === 'KITCHEN') {
    const pendingItems: any[] = [];
    orders
      .filter((order) => order.status === 'IN_PROGRESS')
      .forEach((order) => {
        order.items.forEach((item: any) => {
          if (item.status === 'PREPARING') {
            const tableName = typeof order.tableId === 'string' ? 'Mang đi' : order.tableId?.name || 'Mang đi';
            pendingItems.push({ orderId: order._id, table: tableName, ...item });
          }
        });
      });

    return (
      <View style={styles.screenContainer}>
        <ScreenBackdrop />
        <ScrollView
          style={styles.screenScroll}
          contentContainerStyle={styles.screenContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void fetchActiveOrders(true)} />}
        >
          <View style={styles.screenStack}>
            <Text style={styles.sectionTitle}>Màn hình bếp</Text>
            {loadError ? <ErrorStateView message={loadError} onRetry={() => void fetchActiveOrders()} /> : null}
            {!loadError && pendingItems.length === 0 ? (
              <EmptyStateView message="Không có món nào đang chờ." />
            ) : (
              pendingItems.map((pi, idx) => (
                <View key={`${pi.orderId}-${pi._id || pi.itemId?._id}-${idx}`} style={[styles.glassCard, styles.kitchenCard]}>
                  <Text style={styles.kitchenTableText}>Bàn: {pi.table}</Text>
                  <Text style={styles.kitchenItemText}>{pi.quantity}x {pi.itemId?.name || 'Món'}</Text>
                  {pi.note ? <Text style={styles.kitchenNote}>Ghi chú: {pi.note}</Text> : null}
                  <TouchableOpacity
                    activeOpacity={0.8}
                    style={[styles.buttonBase, styles.buttonPrimary]}
                    onPress={() => handleUpdateItemStatus(pi.orderId, pi._id || pi.itemId?._id, 'READY')}
                  >
                    <Text style={styles.buttonText}>Hoàn thành</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        </ScrollView>
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void fetchActiveOrders(true)} />}
      >
        <View style={styles.screenStack}>
          <Text style={styles.sectionTitle}>Quản lý đơn hàng</Text>

          <View style={[styles.glassCard, styles.inventoryToolbar]}>
            <Text style={styles.helperText}>Danh sách món được lấy từ menu_items và công thức nguyên liệu.</Text>
            <Text style={styles.helperText}>Máy chủ là nguồn dữ liệu cuối cùng cho tồn kho khi tạo/xác nhận/thanh toán đơn.</Text>
            {canCreateStaffOrder ? (
              <TouchableOpacity activeOpacity={0.8} style={[styles.buttonBase, styles.buttonPrimary]} onPress={openCreateOrderForm}>
                <Text style={styles.buttonText}>Tạo đơn thủ công</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {showCreateOrderForm ? (
            <View style={[styles.glassCard, styles.formCard]}>
              <Text style={styles.sectionTitle}>Tạo đơn mới</Text>
              {orderFormLoading ? <LoadingView /> : null}
              {orderFormError ? <Text style={styles.errorText}>{orderFormError}</Text> : null}

              <Text style={styles.helperText}>Chọn bàn</Text>
              <View style={styles.filterRow}>
                {tableOptions.map((table) => {
                  const selected = selectedTableId === table._id;
                  return (
                    <TouchableOpacity
                      key={table._id}
                      activeOpacity={0.8}
                      style={[styles.filterChip, selected ? styles.filterChipActive : null]}
                      onPress={() => setSelectedTableId(table._id)}
                    >
                      <Text style={[styles.filterChipText, selected ? styles.filterChipTextActive : null]}>
                        {table.name} ({getTableStatusLabel(table.status)})
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {tenantId && selectedTableId ? (
                (() => {
                  const currentTable = tableOptions.find((table) => table._id === selectedTableId);
                  const qrToken = currentTable?.qrCodeToken || '';
                  const publicMenuUrl = tenantId ? `${API_BASE_URL}/orders/${tenantId}/menu` : '';
                  const publicOrderUrl = tenantId && qrToken ? `${API_BASE_URL}/orders/${tenantId}/qr/${qrToken}` : '';
                  return (
                    <>
                      <Text style={styles.staffMeta}>Menu công khai: {publicMenuUrl || '-'}</Text>
                      <Text style={styles.staffMeta}>Endpoint đặt món công khai: {publicOrderUrl || '-'}</Text>
                    </>
                  );
                })()
              ) : null}

              <TextInput
                placeholder="Tìm món theo tên"
                value={menuSearch}
                onChangeText={setMenuSearch}
                placeholderTextColor={COLORS.textMuted}
                style={styles.input}
              />

              <TextInput
                placeholder="Ghi chú đơn hàng (tùy chọn)"
                value={orderNote}
                onChangeText={setOrderNote}
                placeholderTextColor={COLORS.textMuted}
                style={styles.input}
              />

              {itemWarnings.length > 0 ? (
                <View style={[styles.glassCard, styles.disabledBlock]}>
                  {itemWarnings.map((warning) => (
                    <Text key={warning} style={styles.errorText}>{warning}</Text>
                  ))}
                </View>
              ) : null}

              <View style={styles.screenStack}>
                {menuItems
                  .filter((item) => item.status !== 'DELETED')
                  .filter((item) => {
                    const keyword = menuSearch.trim().toLowerCase();
                    if (!keyword) return true;
                    return item.name.toLowerCase().includes(keyword);
                  })
                  .map((item) => {
                    const availabilityMeta = getAvailabilityMeta(item);
                    const selectedQuantity = draftItems.find((entry) => entry.menuItemId === item._id)?.quantity || 0;
                    return (
                      <View key={item._id} style={[styles.glassCard, styles.staffCard]}>
                        <Text style={styles.staffName}>{item.name}</Text>
                        <Text style={styles.staffMeta}>Danh mục: {getInventoryCategoryLabel(item.category)}</Text>
                        <Text style={styles.staffMeta}>Giá: {(item.sellingPrice || 0).toLocaleString()}d</Text>
                        <Text style={styles.staffMeta}>Trạng thái: {availabilityMeta.statusLabel}</Text>
                        {availabilityMeta.warning ? <Text style={styles.helperText}>{availabilityMeta.warning}</Text> : null}
                        {availabilityMeta.issues.length > 0 ? (
                          <Text style={styles.helperText}>
                            {availabilityMeta.issues
                              .map((issue) => `${issue.name}: ${issue.availableQuantity}/${issue.requestedQuantity} ${issue.unit}`)
                              .join(' | ')}
                          </Text>
                        ) : null}
                        <View style={styles.inventoryActionRow}>
                          <TouchableOpacity
                            activeOpacity={0.8}
                            disabled={selectedQuantity <= 0}
                            style={[styles.buttonBase, styles.buttonSecondary, styles.flex1, selectedQuantity <= 0 ? styles.moduleCardDisabled : null]}
                            onPress={() => updateDraftItemQuantity(item, selectedQuantity - 1)}
                          >
                            <Text style={styles.buttonText}>-</Text>
                          </TouchableOpacity>
                          <View style={[styles.buttonBase, styles.buttonSecondary, styles.flex1]}>
                            <Text style={styles.buttonText}>Số lượng: {selectedQuantity}</Text>
                          </View>
                          <TouchableOpacity
                            activeOpacity={0.8}
                            disabled={!availabilityMeta.isAvailable}
                            style={[
                              styles.buttonBase,
                              !availabilityMeta.isAvailable ? styles.buttonSecondary : styles.buttonPrimary,
                              styles.flex1,
                              !availabilityMeta.isAvailable ? styles.moduleCardDisabled : null,
                            ]}
                            onPress={() => updateDraftItemQuantity(item, selectedQuantity + 1)}
                          >
                            <Text style={styles.buttonText}>{!availabilityMeta.isAvailable ? 'Hết món' : '+'}</Text>
                          </TouchableOpacity>
                        </View>
                        {!availabilityMeta.isAvailable ? <Text style={styles.helperText}>Không thể thêm vào giỏ hàng</Text> : null}
                      </View>
                    );
                  })}
              </View>

              <View style={styles.rowSplit}>
                <TouchableOpacity activeOpacity={0.8} style={[styles.buttonBase, styles.buttonSecondary, styles.flex1]} onPress={closeCreateOrderForm}>
                  <Text style={styles.buttonText}>Hủy</Text>
                </TouchableOpacity>
                <TouchableOpacity activeOpacity={0.8} style={[styles.buttonBase, styles.buttonPrimary, styles.flex1]} onPress={() => void handleSubmitCreateOrder()}>
                  {orderSubmitting ? <ActivityIndicator color={COLORS.text} /> : <Text style={styles.buttonText}>Tạo đơn</Text>}
                </TouchableOpacity>
              </View>
            </View>
          ) : null}

          {loadError ? <ErrorStateView message={loadError} onRetry={() => void fetchActiveOrders()} /> : null}

          {!loadError && orders.length === 0 ? (
            <EmptyStateView message="Không có đơn hàng nào." />
          ) : (
            orders.map((order) => (
              <View key={order._id} style={[styles.glassCard, styles.orderCard]}>
                <View style={styles.orderHeader}>
                  <Text style={styles.orderTableText}>
                    {typeof order.tableId === 'string' ? 'Mang đi' : order.tableId?.name || 'Mang đi'}
                  </Text>
                  <View style={[styles.statusBadge, order.status === 'PENDING' ? styles.statusPending : styles.statusProgress]}>
                    <Text style={styles.statusText}>{getOrderStatusLabel(order.status)}</Text>
                  </View>
                </View>
                {typeof order.tableId !== 'string' && order.tableId?.status ? (
                  <Text style={styles.staffMeta}>Bàn: {getTableStatusLabel(order.tableId.status)} | Đơn đang mở</Text>
                ) : null}

                <View style={styles.orderItems}>
                  {order.items.map((item: any, index: number) => {
                    const itemStatusStyle =
                      item.status === 'READY'
                        ? styles.itemStatusReady
                        : item.status === 'PREPARING'
                          ? styles.itemStatusPreparing
                          : item.status === 'CANCELLED'
                            ? styles.itemStatusCancelled
                            : styles.itemStatusDefault;

                    const itemKey = item._id || item.itemId?._id || `${order._id}-${index}`;
                    const canMarkReady = order.status === 'IN_PROGRESS' && item.status === 'PREPARING';
                    const canRevertToPreparing = order.status === 'IN_PROGRESS' && item.status === 'READY';

                    return (
                      <View key={itemKey} style={styles.orderItemRowWrap}>
                        <View style={styles.orderItemRow}>
                          <Text style={styles.orderItemText}>{item.quantity}x {item.itemId?.name || 'Món'}</Text>
                          <Text style={[styles.itemStatus, itemStatusStyle]}>{getOrderItemStatusLabel(item.status)}</Text>
                        </View>
                        {canMarkReady ? (
                          <TouchableOpacity
                            activeOpacity={0.8}
                            style={[styles.buttonBase, styles.buttonItemReady]}
                            onPress={() => handleUpdateItemStatus(order._id, itemKey, 'READY')}
                          >
                            <Text style={styles.buttonText}>✓ Đã làm xong</Text>
                          </TouchableOpacity>
                        ) : null}
                        {canRevertToPreparing ? (
                          <TouchableOpacity
                            activeOpacity={0.8}
                            style={[styles.buttonBase, styles.buttonItemRevert]}
                            onPress={() => handleUpdateItemStatus(order._id, itemKey, 'PREPARING')}
                          >
                            <Text style={styles.buttonTextSmall}>↩ Chưa xong, đang làm lại</Text>
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    );
                  })}
                </View>

                {order.status === 'PENDING' ? (
                  <View style={styles.rowSplit}>
                    <TouchableOpacity activeOpacity={0.8} style={[styles.buttonBase, styles.buttonAmber, styles.flex1]} onPress={() => handleConfirmOrder(order)}>
                      <Text style={styles.buttonText}>Xác nhận đơn</Text>
                    </TouchableOpacity>
                    <TouchableOpacity activeOpacity={0.8} style={[styles.buttonBase, styles.buttonSecondary, styles.flex1]} onPress={() => handleRejectOrder(order._id)}>
                      <Text style={styles.buttonText}>Từ chối</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}

                {order.status === 'IN_PROGRESS' ? (
                  <TouchableOpacity activeOpacity={0.8} style={[styles.buttonBase, styles.buttonSuccess]} onPress={() => handleCheckout(order)}>
                    <Text style={styles.buttonText}>Thanh toán ({(order.finalAmount || 0).toLocaleString()}d)</Text>
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
