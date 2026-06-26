import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../../auth/AuthContext';
import { ScreenBackdrop } from '../../components/common/ScreenBackdrop';
import { runConfirmedAction } from '../../components/common/ConfirmAction';
import { EmptyStateView, ErrorStateView, LoadingView, RestrictedStateView } from '../../components/StateViews';
import { API_BASE_URL } from '../../config/api';
import { STAFF_WORKSPACE_ROLES } from '../../constants/roles';
import { getMenuAvailability, getMenuItems, checkMenuItemAvailability, type MenuAvailabilityResult, type MenuItem } from '../../services/menu';
import {
  confirmOrder,
  createStaffOrder,
  getActiveOrders,
  getStaffWorkspace,
  manualCheckoutTableSession,
  rejectOrder,
  updateCustomerRequestStatus,
  updateOrderItemStatus,
  type ActiveOrder,
  type CreateOrderItemInput,
  type CustomerRequest,
  type StaffWorkspaceSession,
} from '../../services/order';
import { getTables, type DiningTable } from '../../services/table';
import { styles } from '../../styles/appStyles';
import { COLORS } from '../../theme';
import { getInventoryCategoryLabel, getOrderItemStatusLabel, getOrderStatusLabel } from '../../utils/displayLabels';

interface ActiveOrderGroup {
  key: string;
  sessionId?: string;
  tableLabel: string;
  tableStatus?: string;
  orders: ActiveOrder[];
  totalAmount: number;
  activeItemCount: number;
  readyItemCount: number;
  hasPending: boolean;
  paymentStatus?: StaffWorkspaceSession['paymentStatus'];
  paymentMethod?: StaffWorkspaceSession['paymentMethod'];
}

export function OrderScreen() {
  const { user, socketRef, socketReady } = useAuth();
  const [orders, setOrders] = useState<ActiveOrder[]>([]);
  const [workspaceSessions, setWorkspaceSessions] = useState<StaffWorkspaceSession[]>([]);
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
      const [activeOrders, staffWorkspace] = await Promise.all([getActiveOrders(), getStaffWorkspace()]);
      setOrders(activeOrders);
      setWorkspaceSessions(staffWorkspace);
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
              const candidateIds = [item._id, item.itemId?._id, item.itemId].filter(Boolean).map(String);
              if (candidateIds.includes(String(data.itemId))) {
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
    const handleWorkspaceChanged = () => void fetchActiveOrders(true);

    socket.on('newQrOrder', handleNewOrder);
    socket.on('orderConfirmed', handleOrderConfirmed);
    socket.on('itemStatusChanged', handleItemStatusChanged);
    socket.on('orderCompleted', handleOrderCompleted);
    socket.on('orderRejected', handleOrderRejected);
    socket.on('customerRequest', handleWorkspaceChanged);
    socket.on('customerRequestUpdated', handleWorkspaceChanged);
    socket.on('paymentPaid', handleWorkspaceChanged);
    socket.on('manualCheckoutCompleted', handleWorkspaceChanged);

    return () => {
      socket.off('newQrOrder', handleNewOrder);
      socket.off('orderConfirmed', handleOrderConfirmed);
      socket.off('itemStatusChanged', handleItemStatusChanged);
      socket.off('orderCompleted', handleOrderCompleted);
      socket.off('orderRejected', handleOrderRejected);
      socket.off('customerRequest', handleWorkspaceChanged);
      socket.off('customerRequestUpdated', handleWorkspaceChanged);
      socket.off('paymentPaid', handleWorkspaceChanged);
      socket.off('manualCheckoutCompleted', handleWorkspaceChanged);
    };
  }, [fetchActiveOrders, socketReady, socketRef]);

  const syncAfterAction = useCallback(() => {
    void fetchActiveOrders(true);
  }, [fetchActiveOrders]);

  const handleUpdateItemStatus = useCallback(
    (orderId: string, itemId: string, status: 'READY' | 'SERVED' | 'PREPARING' | 'PENDING' | 'CANCELLED') => {
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

  const handleCheckoutGroup = useCallback(
    (group: ActiveOrderGroup) => {
      runConfirmedAction({
        title: 'Xác nhận đã thanh toán',
        message: `Xác nhận ${group.tableLabel} đã thanh toán thủ công cho toàn bộ phiên bàn?`,
        confirmText: 'Đã thanh toán',
        onConfirm: async () => {
          try {
            for (const order of group.orders) {
              const canContinue = await validateOrderAgainstLatestStock(order);
              if (!canContinue) return;
            }
            if (group.sessionId) {
              await manualCheckoutTableSession(group.sessionId, 0, 'FLAT');
            } else {
              throw new Error('Không tìm thấy phiên bàn để thanh toán');
            }
            syncAfterAction();
            Alert.alert('Thành công', `${group.tableLabel} đã được xác nhận thanh toán.`);
          } catch (err: any) {
            Alert.alert('Lỗi', mapOrderErrorMessage(err, 'Không thể xác nhận thanh toán'));
          }
        },
      });
    },
    [mapOrderErrorMessage, syncAfterAction, validateOrderAgainstLatestStock],
  );

  const getRequestTypeLabel = useCallback((type: CustomerRequest['type']) => {
    if (type === 'CALL_STAFF') return 'Gọi nhân viên';
    if (type === 'PAY_CASH') return 'Thanh toán tiền mặt';
    if (type === 'PAY_TRANSFER') return 'Thanh toán chuyển khoản';
    if (type === 'PRINT_BILL') return 'In hóa đơn có QR';
    return type;
  }, []);

  const getRequestStatusLabel = useCallback((status: CustomerRequest['status']) => {
    if (status === 'PENDING') return 'Chờ xử lý';
    if (status === 'ACKNOWLEDGED') return 'Đã nhận';
    if (status === 'DONE') return 'Đã xong';
    if (status === 'CANCELLED') return 'Đã hủy';
    return status;
  }, []);

  const handleUpdateRequestStatus = useCallback(
    (request: CustomerRequest, status: Exclude<CustomerRequest['status'], 'PENDING'>) => {
      runConfirmedAction({
        title: 'Cập nhật yêu cầu',
        message: `Chuyển yêu cầu "${getRequestTypeLabel(request.type)}" sang "${getRequestStatusLabel(status)}"?`,
        confirmText: getRequestStatusLabel(status),
        destructive: status === 'CANCELLED',
        onConfirm: async () => {
          try {
            await updateCustomerRequestStatus(request._id, status);
            syncAfterAction();
          } catch (err: any) {
            Alert.alert('Lỗi', err.response?.data?.message || 'Không thể cập nhật yêu cầu');
          }
        },
      });
    },
    [getRequestStatusLabel, getRequestTypeLabel, syncAfterAction],
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

  const activeOrderGroups = useMemo<ActiveOrderGroup[]>(() => {
    const groupMap = new Map<string, ActiveOrderGroup>();
    const workspaceBySession = new Map(workspaceSessions.map((session) => [session.sessionId, session]));

    orders.forEach((order) => {
      const sessionRef = order.sessionId;
      const sessionId = typeof sessionRef === 'string' ? sessionRef : sessionRef?._id;
      const workspaceSession = sessionId ? workspaceBySession.get(sessionId) : undefined;
      const tableId = typeof order.tableId === 'string' ? order.tableId : order.tableId?._id;
      const tableLabel = typeof order.tableId === 'string' ? 'Mang đi' : order.tableId?.name || 'Mang đi';
      const tableStatus = typeof order.tableId === 'string' ? undefined : order.tableId?.status;
      const key = sessionId || tableId || order._id;
      const activeItems = (order.items || []).filter((item: any) => item.status !== 'CANCELLED');
      const readyItems = activeItems.filter((item: any) => item.status === 'READY' || item.status === 'SERVED');
      const orderAmount = Number(order.finalAmount ?? order.totalAmount ?? 0);

      const existing = groupMap.get(key);
      if (existing) {
        existing.orders.push(order);
        existing.totalAmount += orderAmount;
        existing.activeItemCount += activeItems.length;
        existing.readyItemCount += readyItems.length;
        existing.hasPending = existing.hasPending || order.status === 'PENDING';
        return;
      }

      groupMap.set(key, {
        key,
        sessionId,
        tableLabel,
        tableStatus,
        orders: [order],
        totalAmount: orderAmount,
        activeItemCount: activeItems.length,
        readyItemCount: readyItems.length,
        hasPending: order.status === 'PENDING',
        paymentStatus: workspaceSession?.paymentStatus,
        paymentMethod: workspaceSession?.paymentMethod,
      });
    });

    return Array.from(groupMap.values());
  }, [orders, workspaceSessions]);

  const pendingCustomerRequests = useMemo(
    () =>
      workspaceSessions.flatMap((session) =>
        (session.requests || []).map((request) => ({
          ...request,
          tableLabel: session.table?.name || request.tableName || 'Mang đi',
          customerName: session.customer?.name || request.customerName,
          customerPhone: session.customer?.phone || request.customerPhone,
        })),
      ),
    [workspaceSessions],
  );

  if (!user || !STAFF_WORKSPACE_ROLES.includes(user.role)) {
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

          {pendingCustomerRequests.length > 0 ? (
            <View style={[styles.glassCard, styles.orderCard]}>
              <Text style={styles.sectionTitle}>Yêu cầu khách</Text>
              {pendingCustomerRequests.map((request) => (
                <View key={request._id} style={styles.orderItems}>
                  <View style={styles.orderHeader}>
                    <Text style={styles.orderTableText}>{request.tableLabel}</Text>
                    <View style={[styles.statusBadge, request.status === 'PENDING' ? styles.statusPending : styles.statusProgress]}>
                      <Text style={styles.statusText}>{getRequestStatusLabel(request.status)}</Text>
                    </View>
                  </View>
                  <Text style={styles.staffName}>{getRequestTypeLabel(request.type)}</Text>
                  <Text style={styles.staffMeta}>
                    {request.customerName || 'Khách'} {request.customerPhone ? `- ${request.customerPhone}` : ''}
                  </Text>
                  {request.message ? <Text style={styles.helperText}>{request.message}</Text> : null}
                  <View style={styles.rowSplit}>
                    {request.status === 'PENDING' ? (
                      <TouchableOpacity
                        activeOpacity={0.8}
                        style={[styles.buttonBase, styles.buttonSecondary, styles.flex1]}
                        onPress={() => handleUpdateRequestStatus(request, 'ACKNOWLEDGED')}
                      >
                        <Text style={styles.buttonText}>Đã nhận</Text>
                      </TouchableOpacity>
                    ) : null}
                    <TouchableOpacity
                      activeOpacity={0.8}
                      style={[styles.buttonBase, styles.buttonSuccess, styles.flex1]}
                      onPress={() => handleUpdateRequestStatus(request, 'DONE')}
                    >
                      <Text style={styles.buttonText}>Xong</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          ) : null}

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

          {!loadError && activeOrderGroups.length === 0 ? (
            <EmptyStateView message="Không có đơn hàng nào." />
          ) : (
            activeOrderGroups.map((group) => {
              const groupStatusLabel = group.hasPending
                ? 'Có đơn chờ'
                : group.activeItemCount > 0 && group.readyItemCount === group.activeItemCount
                  ? 'Món đã xong'
                  : 'Đang xử lý';

              return (
                <View key={group.key} style={[styles.glassCard, styles.orderCard]}>
                  <View style={styles.orderHeader}>
                    <Text style={styles.orderTableText}>{group.tableLabel}</Text>
                    <View style={[styles.statusBadge, group.hasPending ? styles.statusPending : styles.statusProgress]}>
                      <Text style={styles.statusText}>{groupStatusLabel}</Text>
                    </View>
                  </View>
                  {group.tableStatus ? (
                    <Text style={styles.staffMeta}>
                      Bàn: {getTableStatusLabel(group.tableStatus)} | {group.orders.length} đơn trong phiên | {group.readyItemCount}/{group.activeItemCount} món đã xong
                    </Text>
                  ) : null}
                  {group.paymentStatus === 'PAID' ? (
                    <Text style={styles.staffMeta}>
                      Thanh toán: đã nhận {group.paymentMethod === 'TRANSFER' ? 'chuyển khoản' : 'thủ công'} - cần xác nhận đóng phiên
                    </Text>
                  ) : group.paymentStatus === 'REQUESTED' ? (
                    <Text style={styles.staffMeta}>Thanh toán: khách đã gửi yêu cầu</Text>
                  ) : null}

                  {group.orders.map((order) => (
                    <View key={order._id} style={styles.orderItems}>
                      <Text style={styles.staffMeta}>
                        Đơn #{order._id.slice(-6).toUpperCase()} - {getOrderStatusLabel(order.status)}
                      </Text>
                      {order.items.map((item: any, index: number) => {
                        const itemStatusStyle =
                          item.status === 'READY' || item.status === 'SERVED'
                            ? styles.itemStatusReady
                            : item.status === 'PREPARING'
                              ? styles.itemStatusPreparing
                              : item.status === 'CANCELLED'
                                ? styles.itemStatusCancelled
                                : styles.itemStatusDefault;

                        const itemKey = item._id || item.itemId?._id || `${order._id}-${index}`;
                        const canMarkServed = order.status === 'IN_PROGRESS' && item.status === 'READY';

                        return (
                          <View key={itemKey} style={styles.orderItemRowWrap}>
                            <View style={styles.orderItemRow}>
                              <Text style={styles.orderItemText}>{item.quantity}x {item.itemId?.name || 'Món'}</Text>
                              <Text style={[styles.itemStatus, itemStatusStyle]}>{getOrderItemStatusLabel(item.status)}</Text>
                            </View>
                            {canMarkServed ? (
                              <TouchableOpacity
                                activeOpacity={0.8}
                                style={[styles.buttonBase, styles.buttonItemReady]}
                                onPress={() => handleUpdateItemStatus(order._id, itemKey, 'SERVED')}
                              >
                                <Text style={styles.buttonText}>✓ Đã phục vụ</Text>
                              </TouchableOpacity>
                            ) : null}
                          </View>
                        );
                      })}

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
                    </View>
                  ))}

                  <TouchableOpacity
                    activeOpacity={0.8}
                    disabled={group.hasPending}
                    style={[styles.buttonBase, group.hasPending ? styles.buttonSecondary : styles.buttonSuccess, group.hasPending ? styles.moduleCardDisabled : null]}
                    onPress={() => handleCheckoutGroup(group)}
                  >
                    <Text style={styles.buttonText}>
                      {group.hasPending
                        ? 'Xác nhận đơn trước khi thanh toán'
                        : `Xác nhận đã thanh toán thủ công (${group.totalAmount.toLocaleString()}d)`}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </View>
  );
}
