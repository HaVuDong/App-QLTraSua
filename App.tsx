import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { NavigationContainer, DarkTheme, useNavigation } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { io } from 'socket.io-client';
import { Calendar, CheckCircle, Coffee, Home, LogOut, Users } from 'lucide-react-native';
import { COLORS, SIZES, SPACING, TYPOGRAPHY, SHADOWS } from './src/theme';
import { ADMIN_DASHBOARD_ROLES, MANAGEMENT_ROLES, ORDER_ROLES, SHIFT_ROLES, VALID_ROLES } from './src/constants/roles';
import { isTokenExpired, parseJwt, userFromTokenPayload } from './src/utils/jwt';
import { clearAccessToken, getOrCreateDeviceId, loadAccessToken, saveAccessToken } from './src/storage/session';
import { API_BASE_URL } from './src/config/api';
import { api, attachApiInterceptors, setApiToken } from './src/services/api';
import {
  createInventoryItem,
  deleteInventoryItem,
  getInventoryItems,
  getInventoryStatusSummary,
  updateInventoryItem,
  type InventoryCategory,
  type InventoryItem,
} from './src/services/inventory';
import {
  createTable,
  deleteTable,
  getTables,
  resetTableQr,
  toggleTableVisibility,
  updateTable,
  updateTableStatus,
  type DiningTable,
  type TableStatus,
} from './src/services/table';
import {
  changeStaffRole,
  createStaffUser,
  deactivateStaffUser,
  getStaffUsers,
  lockStaffUser,
  resetStaffPassword,
  unlockStaffUser,
  updateStaffUser,
  type StaffRole,
  type StaffStatus,
  type StaffUser,
} from './src/services/staff';
import {
  editAttendanceRecord,
  getDailyAttendance,
  getMonthlyAttendance,
  type DailyAttendanceRow,
  type MonthlyAttendanceData,
} from './src/services/attendance';
import {
  calculatePayroll,
  getPayrollRecordDetail,
  getPayrollRecords,
  type PayrollRecord,
} from './src/services/payroll';
import {
  checkoutOrder,
  confirmOrder,
  createStaffOrder,
  getActiveOrders,
  rejectOrder,
  updateOrderItemStatus,
  type ActiveOrder,
  type CreateOrderItemInput,
} from './src/services/order';
import { EmptyStateView, ErrorStateView, LoadingView, RestrictedStateView } from './src/components/StateViews';
import type { SessionUser } from './src/types/auth';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

type AuthContextValue = {
  token: string;
  user: SessionUser | null;
  deviceId: string;
  socketReady: boolean;
  socketRef: React.MutableRefObject<any>;
  loading: boolean;
  error: string;
  requiresOtp: boolean;
  requiresPasswordChange: boolean;
  tempToken: string;
  handleLogin: (email: string, phone: string, pass: string) => Promise<void>;
  handleVerifyDevice: (otpCode: string) => Promise<void>;
  handleChangePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  handlePasswordChangeCancel: () => Promise<void>;
  handleLogout: () => Promise<void>;
  resetOtpFlow: () => void;
};

const AuthContext = React.createContext<AuthContextValue | null>(null);

function useAuth() {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthContext.Provider');
  }
  return context;
}

function ScreenBackdrop() {
  return (
    <View pointerEvents="none" style={styles.backgroundGradient}>
      <View style={styles.backgroundBase} />
      <View style={styles.glowTopLeft} />
      <View style={styles.glowBottomRight} />
    </View>
  );
}

function AuthScreen() {
  const { handleLogin, handleVerifyDevice, error, loading, requiresOtp, deviceId, resetOtpFlow } = useAuth();
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');

  const submitLogin = () => {
    if (!email.trim() && !phone.trim()) {
      Alert.alert('Thieu thong tin', 'Vui long nhap email hoac so dien thoai.');
      return;
    }
    if (!password.trim()) {
      Alert.alert('Thieu thong tin', 'Vui long nhap mat khau.');
      return;
    }
    void handleLogin(email.trim(), phone.trim(), password);
  };

  const submitOtp = () => {
    if (otpCode.trim().length !== 6) {
      Alert.alert('OTP khong hop le', 'Vui long nhap ma OTP 6 so.');
      return;
    }
    void handleVerifyDevice(otpCode.trim());
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ScreenBackdrop />
      <View style={[styles.glassCard, styles.authCard]}>
        <View style={styles.authHeader}>
          <Text style={styles.brandTitle}>TRASUA POS</Text>
          <Text style={styles.brandSubtitle}>Super App Van Hanh</Text>
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {!requiresOtp ? (
          <View style={styles.formStack}>
            <TextInput
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
              placeholderTextColor={COLORS.textMuted}
              style={styles.input}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <TextInput
              placeholder="So dien thoai"
              value={phone}
              onChangeText={setPhone}
              placeholderTextColor={COLORS.textMuted}
              style={styles.input}
              keyboardType="phone-pad"
            />
            <TextInput
              placeholder="Mat khau"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholderTextColor={COLORS.textMuted}
              style={styles.input}
            />

            <TouchableOpacity activeOpacity={0.8} style={[styles.buttonBase, styles.buttonPrimary]} onPress={submitLogin}>
              {loading ? <ActivityIndicator color={COLORS.text} /> : <Text style={styles.buttonText}>Dang Nhap</Text>}
            </TouchableOpacity>

            <Text style={styles.helperText}>Device ID: {deviceId || 'Dang khoi tao...'}</Text>
          </View>
        ) : (
          <View style={styles.formStack}>
            <Text style={styles.otpNotice}>Thiet bi la. Nhap ma OTP duoc cap boi Admin.</Text>
            <TextInput
              placeholder="Nhap 6 so OTP"
              value={otpCode}
              onChangeText={setOtpCode}
              keyboardType="numeric"
              maxLength={6}
              placeholderTextColor={COLORS.textMuted}
              style={[styles.input, styles.inputOtp]}
            />
            <View style={styles.rowSplit}>
              <TouchableOpacity activeOpacity={0.8} style={[styles.buttonBase, styles.buttonSecondary, styles.flex1]} onPress={resetOtpFlow}>
                <Text style={styles.buttonText}>Huy</Text>
              </TouchableOpacity>
              <TouchableOpacity activeOpacity={0.8} style={[styles.buttonBase, styles.buttonPrimary, styles.flex1]} onPress={submitOtp}>
                <Text style={styles.buttonText}>Xac Thuc</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

function ChangePasswordScreen() {
  const { handleChangePassword, handlePasswordChangeCancel, error, loading } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localError, setLocalError] = useState('');

  const onSubmit = () => {
    setLocalError('');

    if (!currentPassword || !newPassword || !confirmPassword) {
      setLocalError('Vui long nhap day du thong tin');
      return;
    }
    if (newPassword.length < 8) {
      setLocalError('Mat khau moi phai co it nhat 8 ky tu');
      return;
    }
    if (newPassword !== confirmPassword) {
      setLocalError('Mat khau xac nhan khong khop');
      return;
    }

    void handleChangePassword(currentPassword, newPassword);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ScreenBackdrop />
      <View style={[styles.glassCard, styles.authCard]}>
        <View style={styles.authHeader}>
          <Text style={styles.brandTitle}>DOI MAT KHAU</Text>
          <Text style={styles.brandSubtitle}>Ban can doi mat khau truoc khi tiep tuc</Text>
        </View>

        {error || localError ? <Text style={styles.errorText}>{localError || error}</Text> : null}

        <View style={styles.formStack}>
          <TextInput
            placeholder="Mat khau hien tai"
            value={currentPassword}
            onChangeText={setCurrentPassword}
            secureTextEntry
            placeholderTextColor={COLORS.textMuted}
            style={styles.input}
          />
          <TextInput
            placeholder="Mat khau moi (it nhat 8 ky tu)"
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry
            placeholderTextColor={COLORS.textMuted}
            style={styles.input}
          />
          <TextInput
            placeholder="Xac nhan mat khau moi"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            placeholderTextColor={COLORS.textMuted}
            style={styles.input}
          />

          <TouchableOpacity activeOpacity={0.8} style={[styles.buttonBase, styles.buttonPrimary]} onPress={onSubmit}>
            {loading ? <ActivityIndicator color={COLORS.text} /> : <Text style={styles.buttonText}>Xac Nhan Doi Mat Khau</Text>}
          </TouchableOpacity>

          <TouchableOpacity activeOpacity={0.8} style={[styles.buttonBase, styles.buttonSecondary]} onPress={() => void handlePasswordChangeCancel()}>
            <Text style={styles.buttonText}>Dang xuat</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

function ShiftScreen() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<any[]>([]);
  const [screenLoading, setScreenLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');

  const fetchHistory = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setScreenLoading(true);
      }
      setLoadError('');
      const res = await api.get('/attendance/history');
      setLogs(Array.isArray(res.data) ? res.data : []);
    } catch (err: any) {
      setLoadError(err.response?.data?.message || 'Khong the tai lich su diem danh');
    } finally {
      setScreenLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchHistory();
  }, [fetchHistory]);

  const handleAction = useCallback(
    (action: 'checkin' | 'checkout') => {
      Alert.alert(
        action === 'checkin' ? 'Xac nhan vao ca' : 'Xac nhan ra ca',
        action === 'checkin' ? 'Ban muon check-in ngay bay gio?' : 'Ban muon check-out ngay bay gio?',
        [
          { text: 'Huy', style: 'cancel' },
          {
            text: 'Dong y',
            onPress: async () => {
              try {
                await api.post(`/attendance/${action === 'checkin' ? 'check-in' : 'check-out'}`, { gps: '10.7,106.6' });
                Alert.alert('Thanh cong', action === 'checkin' ? 'Da check-in' : 'Da check-out');
                void fetchHistory(true);
              } catch (err: any) {
                Alert.alert('Loi', err.response?.data?.message || 'Co loi xay ra');
              }
            },
          },
        ],
      );
    },
    [fetchHistory],
  );

  if (!user || !SHIFT_ROLES.includes(user.role)) {
    return (
      <View style={styles.screenContainer}>
        <ScreenBackdrop />
        <RestrictedStateView message="Ban khong co quyen truy cap man hinh ca lam." />
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void fetchHistory(true)} />}
      >
        <View style={styles.screenStack}>
          <Text style={styles.sectionTitle}>Diem danh ca lam viec</Text>
          <View style={styles.bentoRow}>
            <TouchableOpacity activeOpacity={0.8} onPress={() => handleAction('checkin')} style={[styles.bentoCard, styles.bentoCardGreen]}>
              <View style={[styles.iconBadge, styles.iconBadgeGreen]}>
                <CheckCircle color={COLORS.primaryLight} size={SIZES.iconLg} />
              </View>
              <Text style={styles.bentoTitle}>Vao Ca</Text>
            </TouchableOpacity>
            <TouchableOpacity activeOpacity={0.8} onPress={() => handleAction('checkout')} style={[styles.bentoCard, styles.bentoCardAmber]}>
              <View style={[styles.iconBadge, styles.iconBadgeAmber]}>
                <LogOut color={COLORS.secondaryLight} size={SIZES.iconLg} />
              </View>
              <Text style={styles.bentoTitle}>Ra Ca</Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.sectionTitle, styles.sectionTitleSpacing]}>Lich su cham cong</Text>

          {loadError ? <ErrorStateView message={loadError} onRetry={() => void fetchHistory()} /> : null}

          {!loadError && logs.length === 0 ? (
            <EmptyStateView message="Chua co du lieu lich su cham cong." />
          ) : (
            logs.map((log) => (
              <View key={log._id} style={styles.historyCard}>
                <Text style={styles.historyText}>Ngay: {new Date(log.date).toLocaleDateString()}</Text>
                <Text style={styles.historyText}>Vao: {log.checkInTime ? new Date(log.checkInTime).toLocaleTimeString() : '--:--'}</Text>
                <Text style={styles.historyText}>Ra: {log.checkOutTime ? new Date(log.checkOutTime).toLocaleTimeString() : '--:--'}</Text>
                <Text style={styles.historyTextStrong}>Tong gio: {log.totalHours || 0}h</Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function OrderScreen() {
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
  const [menuItems, setMenuItems] = useState<InventoryItem[]>([]);
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

  const isMenuItemUnavailable = useCallback((item: InventoryItem) => {
    return item.status !== 'ACTIVE' || item.stock <= 0;
  }, []);

  const getTableStatusLabel = useCallback((status?: string) => {
    if (status === 'SERVING') return 'Dang hoat dong';
    if (status === 'PAYING') return 'Dang thanh toan';
    if (status === 'CLEANING') return 'Dang don dep';
    return 'Con trong';
  }, []);

  const getStockCheckIssues = useCallback(
    (orderItems: Array<{ itemId: string; quantity: number }>, currentMenuItems: InventoryItem[]) => {
      const inventoryById = new Map(currentMenuItems.map((item) => [item._id, item]));
      const totalByItem = new Map<string, number>();
      orderItems.forEach((entry) => {
        totalByItem.set(entry.itemId, (totalByItem.get(entry.itemId) || 0) + entry.quantity);
      });

      const issues: string[] = [];
      totalByItem.forEach((totalQuantity, itemId) => {
        const inventoryItem = inventoryById.get(itemId);
        if (!inventoryItem || inventoryItem.status !== 'ACTIVE') {
          issues.push(`Mon ${itemId} da ngung ban`);
          return;
        }
        if (inventoryItem.stock <= 0) {
          issues.push(`${inventoryItem.name}: Het mon`);
          return;
        }
        if (totalQuantity > inventoryItem.stock) {
          issues.push(`${inventoryItem.name}: Khong du so luong ton kho (ton: ${inventoryItem.stock})`);
        }
      });

      return issues;
    },
    [],
  );

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
      setLoadError(err.response?.data?.message || 'Khong the tai danh sach don hang');
    } finally {
      setScreenLoading(false);
      setRefreshing(false);
    }
  }, []);

  const fetchOrderFormResources = useCallback(async () => {
    try {
      setOrderFormLoading(true);
      setOrderFormError('');
      const [tables, items] = await Promise.all([getTables(), getInventoryItems()]);
      const visibleTables = tables.filter((table) => !table.isHidden);
      setTableOptions(visibleTables);
      setMenuItems(items);
    } catch (err: any) {
      setOrderFormError(err.response?.data?.message || 'Khong the tai menu/ban cho tao don');
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
      Alert.alert('Xac nhan', 'Ban muon cap nhat trang thai mon nay?', [
        { text: 'Huy', style: 'cancel' },
        {
          text: 'Dong y',
          onPress: async () => {
            try {
              await updateOrderItemStatus(orderId, itemId, status);
              syncAfterAction();
            } catch (err: any) {
              Alert.alert('Loi', err.response?.data?.message || 'Co loi xay ra');
            }
          },
        },
      ]);
    },
    [syncAfterAction],
  );

  const validateOrderAgainstLatestStock = useCallback(
    async (order: ActiveOrder) => {
      const latestMenuItems = await getInventoryItems();
      const normalizedOrderItems = (order.items || [])
        .filter((item: any) => item.status !== 'CANCELLED')
        .map((item: any) => ({ itemId: getOrderItemId(item), quantity: Number(item.quantity || 0) }))
        .filter((item) => !!item.itemId && item.quantity > 0);

      const issues = getStockCheckIssues(normalizedOrderItems, latestMenuItems);
      if (issues.length > 0) {
        Alert.alert('Khong du so luong ton kho', `${issues.join('\n')}\n\nKhong the tao don vi het hang hoac ton kho khong du.`);
        return false;
      }
      return true;
    },
    [getOrderItemId, getStockCheckIssues],
  );

  const handleConfirmOrder = useCallback(
    (order: ActiveOrder) => {
      Alert.alert('Xac nhan don', 'Ban chac chan muon xac nhan don nay?', [
        { text: 'Huy', style: 'cancel' },
        {
          text: 'Xac nhan',
          onPress: async () => {
            try {
              const canContinue = await validateOrderAgainstLatestStock(order);
              if (!canContinue) return;
              await confirmOrder(order._id);
              syncAfterAction();
            } catch (err: any) {
              Alert.alert('Loi', err.response?.data?.message || 'Co loi xay ra');
            }
          },
        },
      ]);
    },
    [syncAfterAction, validateOrderAgainstLatestStock],
  );

  const handleRejectOrder = useCallback(
    (orderId: string) => {
      Alert.alert('Tu choi don', 'Ban chac chan muon tu choi don nay?', [
        { text: 'Huy', style: 'cancel' },
        {
          text: 'Tu choi',
          style: 'destructive',
          onPress: async () => {
            try {
              await rejectOrder(orderId, 'Tu choi boi nhan vien');
              syncAfterAction();
            } catch (err: any) {
              Alert.alert('Loi', err.response?.data?.message || 'Khong the tu choi don');
            }
          },
        },
      ]);
    },
    [syncAfterAction],
  );

  const handleCheckout = useCallback(
    (order: ActiveOrder) => {
      Alert.alert('Thanh toan', 'Xac nhan thanh toan don hang nay?', [
        { text: 'Huy', style: 'cancel' },
        {
          text: 'Thanh toan',
          onPress: async () => {
            try {
              const canContinue = await validateOrderAgainstLatestStock(order);
              if (!canContinue) return;
              await checkoutOrder(order._id, 0, 'FLAT');
              syncAfterAction();
              Alert.alert('Thanh cong', 'Tao don thanh cong va da cap nhat trang thai don.');
            } catch (err: any) {
              Alert.alert('Loi', err.response?.data?.message || 'Tao don that bai');
            }
          },
        },
      ]);
    },
    [syncAfterAction, validateOrderAgainstLatestStock],
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
    (item: InventoryItem, nextQuantity: number) => {
      if (isMenuItemUnavailable(item)) {
        Alert.alert('Het mon', `${item.name} dang het hang hoac tam ngung ban.`);
        return;
      }

      if (nextQuantity <= 0) {
        setDraftItems((prev) => prev.filter((entry) => entry.itemId !== item._id));
        return;
      }

      if (nextQuantity > item.stock) {
        Alert.alert('Khong du so luong ton kho', `Ton kho hien tai cua ${item.name} chi con ${item.stock}.`);
        return;
      }

      setDraftItems((prev) => {
        const existing = prev.find((entry) => entry.itemId === item._id);
        if (existing) {
          return prev.map((entry) => (entry.itemId === item._id ? { ...entry, quantity: nextQuantity } : entry));
        }
        return [...prev, { itemId: item._id, quantity: nextQuantity }];
      });
    },
    [isMenuItemUnavailable],
  );

  const handleSubmitCreateOrder = useCallback(async () => {
    if (!selectedTableId) {
      setOrderFormError('Ban la bat buoc');
      return;
    }
    if (draftItems.length === 0) {
      setOrderFormError('Khong the them vao gio hang: chua chon mon');
      return;
    }

    setOrderSubmitting(true);
    setOrderFormError('');
    setItemWarnings([]);

    try {
      const latestMenuItems = await getInventoryItems();
      const issues = getStockCheckIssues(draftItems, latestMenuItems);
      if (issues.length > 0) {
        setItemWarnings(issues);
        setOrderFormError('Khong the tao don vi het hang');
        return;
      }

      await createStaffOrder({
        tableId: selectedTableId,
        items: draftItems,
        orderNote: orderNote.trim() || undefined,
      });

      Alert.alert('Thanh cong', 'Tao don thanh cong');
      closeCreateOrderForm();
      await fetchOrderFormResources();
      void fetchActiveOrders(true);
    } catch (err: any) {
      const backendMessage = err.response?.data?.message || 'Tao don that bai';
      setOrderFormError(backendMessage);
      Alert.alert('Tao don that bai', backendMessage);
    } finally {
      setOrderSubmitting(false);
    }
  }, [closeCreateOrderForm, draftItems, fetchActiveOrders, fetchOrderFormResources, getStockCheckIssues, orderNote, selectedTableId]);

  if (!user || !ORDER_ROLES.includes(user.role)) {
    return (
      <View style={styles.screenContainer}>
        <ScreenBackdrop />
        <RestrictedStateView message="Ban khong co quyen truy cap man hinh don hang." />
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
            const tableName = typeof order.tableId === 'string' ? 'Mang di' : order.tableId?.name || 'Mang di';
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
            <Text style={styles.sectionTitle}>Man hinh bep</Text>
            {loadError ? <ErrorStateView message={loadError} onRetry={() => void fetchActiveOrders()} /> : null}
            {!loadError && pendingItems.length === 0 ? (
              <EmptyStateView message="Khong co mon nao dang cho." />
            ) : (
              pendingItems.map((pi, idx) => (
                <View key={`${pi.orderId}-${pi._id || pi.itemId?._id}-${idx}`} style={[styles.glassCard, styles.kitchenCard]}>
                  <Text style={styles.kitchenTableText}>Ban: {pi.table}</Text>
                  <Text style={styles.kitchenItemText}>{pi.quantity}x {pi.itemId?.name || 'Mon'}</Text>
                  {pi.note ? <Text style={styles.kitchenNote}>Ghi chu: {pi.note}</Text> : null}
                  <TouchableOpacity
                    activeOpacity={0.8}
                    style={[styles.buttonBase, styles.buttonPrimary]}
                    onPress={() => handleUpdateItemStatus(pi.orderId, pi._id || pi.itemId?._id, 'READY')}
                  >
                    <Text style={styles.buttonText}>Hoan Thanh</Text>
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
          <Text style={styles.sectionTitle}>Quan ly Don Hang</Text>

          <View style={[styles.glassCard, styles.inventoryToolbar]}>
            <Text style={styles.helperText}>Hien tai he thong chua ho tro tru kho theo cong thuc nguyen lieu</Text>
            <Text style={styles.helperText}>Backend la nguon su that cuoi cung cho ton kho khi tao/thanh toan don.</Text>
            {canCreateStaffOrder ? (
              <TouchableOpacity activeOpacity={0.8} style={[styles.buttonBase, styles.buttonPrimary]} onPress={openCreateOrderForm}>
                <Text style={styles.buttonText}>Tao don thu cong</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {showCreateOrderForm ? (
            <View style={[styles.glassCard, styles.formCard]}>
              <Text style={styles.sectionTitle}>Tao don moi</Text>
              {orderFormLoading ? <LoadingView /> : null}
              {orderFormError ? <Text style={styles.errorText}>{orderFormError}</Text> : null}

              <Text style={styles.helperText}>Chon ban</Text>
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
                      <Text style={styles.staffMeta}>Public menu: {publicMenuUrl || '-'}</Text>
                      <Text style={styles.staffMeta}>Public order endpoint: {publicOrderUrl || '-'}</Text>
                    </>
                  );
                })()
              ) : null}

              <TextInput
                placeholder="Tim mon theo ten"
                value={menuSearch}
                onChangeText={setMenuSearch}
                placeholderTextColor={COLORS.textMuted}
                style={styles.input}
              />

              <TextInput
                placeholder="Ghi chu don hang (tuy chon)"
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
                    const unavailable = isMenuItemUnavailable(item);
                    const lowStock = !unavailable && item.stock <= item.minStockLevel;
                    const selectedQuantity = draftItems.find((entry) => entry.itemId === item._id)?.quantity || 0;
                    return (
                      <View key={item._id} style={[styles.glassCard, styles.staffCard]}>
                        <Text style={styles.staffName}>{item.name}</Text>
                        <Text style={styles.staffMeta}>Ton kho hien tai: {item.stock} {item.unit}</Text>
                        <Text style={styles.staffMeta}>Gia: {(item.sellingPrice || 0).toLocaleString()}d</Text>
                        <Text style={styles.staffMeta}>
                          Trang thai: {unavailable ? 'Het mon' : lowStock ? 'Sap het hang' : 'San sang'}
                        </Text>
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
                            <Text style={styles.buttonText}>So luong: {selectedQuantity}</Text>
                          </View>
                          <TouchableOpacity
                            activeOpacity={0.8}
                            disabled={unavailable}
                            style={[styles.buttonBase, unavailable ? styles.buttonSecondary : styles.buttonPrimary, styles.flex1, unavailable ? styles.moduleCardDisabled : null]}
                            onPress={() => updateDraftItemQuantity(item, selectedQuantity + 1)}
                          >
                            <Text style={styles.buttonText}>{unavailable ? 'Het mon' : '+'}</Text>
                          </TouchableOpacity>
                        </View>
                        {unavailable ? <Text style={styles.helperText}>Khong the them vao gio hang</Text> : null}
                      </View>
                    );
                  })}
              </View>

              <View style={styles.rowSplit}>
                <TouchableOpacity activeOpacity={0.8} style={[styles.buttonBase, styles.buttonSecondary, styles.flex1]} onPress={closeCreateOrderForm}>
                  <Text style={styles.buttonText}>Huy</Text>
                </TouchableOpacity>
                <TouchableOpacity activeOpacity={0.8} style={[styles.buttonBase, styles.buttonPrimary, styles.flex1]} onPress={() => void handleSubmitCreateOrder()}>
                  {orderSubmitting ? <ActivityIndicator color={COLORS.text} /> : <Text style={styles.buttonText}>Tao don</Text>}
                </TouchableOpacity>
              </View>
            </View>
          ) : null}

          {loadError ? <ErrorStateView message={loadError} onRetry={() => void fetchActiveOrders()} /> : null}

          {!loadError && orders.length === 0 ? (
            <EmptyStateView message="Khong co don hang nao." />
          ) : (
            orders.map((order) => (
              <View key={order._id} style={[styles.glassCard, styles.orderCard]}>
                <View style={styles.orderHeader}>
                  <Text style={styles.orderTableText}>
                    {typeof order.tableId === 'string' ? 'Mang di' : order.tableId?.name || 'Mang di'}
                  </Text>
                  <View style={[styles.statusBadge, order.status === 'PENDING' ? styles.statusPending : styles.statusProgress]}>
                    <Text style={styles.statusText}>
                      {order.status === 'PENDING' ? 'Cho xac nhan' : order.status === 'IN_PROGRESS' ? 'Dang xu ly' : order.status}
                    </Text>
                  </View>
                </View>
                {typeof order.tableId !== 'string' && order.tableId?.status ? (
                  <Text style={styles.staffMeta}>Ban: {getTableStatusLabel(order.tableId.status)} | Don dang mo</Text>
                ) : null}

                <View style={styles.orderItems}>
                  {order.items.map((item: any, index: number) => {
                    const itemStatusStyle =
                      item.status === 'READY'
                        ? styles.itemStatusReady
                        : item.status === 'PREPARING'
                          ? styles.itemStatusPreparing
                          : styles.itemStatusDefault;

                    return (
                      <View key={`${order._id}-${index}`} style={styles.orderItemRow}>
                        <Text style={styles.orderItemText}>{item.quantity}x {item.itemId?.name || 'Mon'}</Text>
                        <Text style={[styles.itemStatus, itemStatusStyle]}>{item.status}</Text>
                      </View>
                    );
                  })}
                </View>

                {order.status === 'PENDING' ? (
                  <View style={styles.rowSplit}>
                    <TouchableOpacity activeOpacity={0.8} style={[styles.buttonBase, styles.buttonAmber, styles.flex1]} onPress={() => handleConfirmOrder(order)}>
                      <Text style={styles.buttonText}>Xac Nhan Don</Text>
                    </TouchableOpacity>
                    <TouchableOpacity activeOpacity={0.8} style={[styles.buttonBase, styles.buttonSecondary, styles.flex1]} onPress={() => handleRejectOrder(order._id)}>
                      <Text style={styles.buttonText}>Tu choi</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}

                {order.status === 'IN_PROGRESS' ? (
                  <TouchableOpacity activeOpacity={0.8} style={[styles.buttonBase, styles.buttonSuccess]} onPress={() => handleCheckout(order)}>
                    <Text style={styles.buttonText}>Thanh Toan ({(order.finalAmount || 0).toLocaleString()}d)</Text>
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

type AdminModuleRoute = 'Don Hang' | 'Nhan Su' | 'Kho' | 'Menu' | 'Ban' | 'Cham Cong' | 'Bang Luong';

type AdminModuleCard = {
  key: string;
  label: string;
  routeName?: AdminModuleRoute;
};

type InventoryFilterStatus = 'ALL' | 'AVAILABLE' | 'LOW_STOCK' | 'OUT_OF_STOCK';

type InventoryStockAction = 'INCREASE' | 'DECREASE';

const INVENTORY_CATEGORY_OPTIONS: InventoryCategory[] = ['DRINK', 'FOOD', 'FRUIT', 'OTHER'];
const INVENTORY_FILTER_OPTIONS: InventoryFilterStatus[] = ['ALL', 'AVAILABLE', 'LOW_STOCK', 'OUT_OF_STOCK'];
const INVENTORY_ADJUST_REASONS = ['nhap hang', 'huy hang', 'kiem kho', 'hao hut', 'dieu chinh thu cong'] as const;

type MenuViewStatus = 'AVAILABLE' | 'OUT_OF_STOCK' | 'INACTIVE';
const MENU_STATUS_FILTER_OPTIONS: Array<MenuViewStatus | 'ALL'> = ['ALL', 'AVAILABLE', 'OUT_OF_STOCK', 'INACTIVE'];
type TableViewStatus = 'AVAILABLE' | 'ACTIVE' | 'DISABLED';
type StaffFilterRole = StaffRole | 'ALL';
type StaffEditableRole = Exclude<StaffRole, 'SYSTEM_OWNER'>;
type StaffFilterStatus = StaffStatus | 'ALL';

const STAFF_CREATE_ROLE_OPTIONS: StaffEditableRole[] = ['USER', 'KITCHEN', 'MANAGER'];
const STAFF_EDIT_ROLE_OPTIONS: StaffEditableRole[] = ['ADMIN', 'MANAGER', 'USER', 'KITCHEN'];
const STAFF_STATUS_FILTER_OPTIONS: StaffFilterStatus[] = ['ALL', 'ACTIVE', 'LOCKED', 'DELETED'];
type PayrollFilterStatus = StaffStatus | 'UNKNOWN' | 'ALL';
type PayrollViewRow = {
  userId: string;
  name: string;
  account: string;
  role: StaffRole;
  status: StaffStatus | 'UNKNOWN';
  hourlyWage: number | null;
  workedHours: number;
  grossSalary: number | null;
  latePenaltyTotal: number;
  finalSalaryPreview: number | null;
  monthlyAttendance: MonthlyAttendanceData | null;
  penaltyRecords: {
    date: string;
    checkInTime?: string | null;
    lateMinutes: number;
    penaltyAmount: number;
  }[];
  payrollRecord: PayrollRecord | null;
};
type AttendancePrimaryStatus = 'ABSENT' | 'ON_LEAVE' | 'MISSING_CHECKOUT' | 'COMPLETED';
type AttendancePunctualStatus = 'ON_TIME' | 'LATE' | 'UNKNOWN';
type AttendanceFilterStatus = 'ALL' | AttendancePrimaryStatus | AttendancePunctualStatus;

const ATTENDANCE_FILTER_OPTIONS: AttendanceFilterStatus[] = ['ALL', 'COMPLETED', 'MISSING_CHECKOUT', 'LATE', 'ON_TIME', 'ABSENT', 'ON_LEAVE'];
const PAYROLL_STATUS_FILTER_OPTIONS: PayrollFilterStatus[] = ['ALL', 'ACTIVE', 'LOCKED', 'DELETED', 'UNKNOWN'];
const PAYROLL_LATE_MINUTES_THRESHOLD = 5;
const PAYROLL_LATE_PENALTY_AMOUNT = 20000;

function AdminDashboardScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<any>();
  const [dashboard, setDashboard] = useState<any>(null);
  const [screenLoading, setScreenLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');

  const fetchDashboardData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setScreenLoading(true);
      }
      setLoadError('');

      const dashboardRes = await api.get('/reports/dashboard');
      setDashboard(dashboardRes.data || null);
    } catch (err: any) {
      setLoadError(err.response?.data?.message || 'Khong the tai du lieu tong quan');
    } finally {
      setScreenLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchDashboardData();
  }, [fetchDashboardData]);

  if (!user || !MANAGEMENT_ROLES.includes(user.role)) {
    return (
      <View style={styles.screenContainer}>
        <ScreenBackdrop />
        <RestrictedStateView message="Ban khong co quyen truy cap man hinh quan ly." />
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

  const modules: AdminModuleCard[] = [
    { key: 'inventory', label: 'Kho', routeName: 'Kho' },
    { key: 'menu', label: 'Menu', routeName: 'Menu' },
    { key: 'tables', label: 'Ban', routeName: 'Ban' },
    { key: 'staff', label: 'Nhan Su', routeName: 'Nhan Su' },
    { key: 'attendance', label: 'Cham Cong', routeName: 'Cham Cong' },
    { key: 'payroll', label: 'Bang Luong', routeName: 'Bang Luong' },
    { key: 'orders', label: 'Don Hang', routeName: 'Don Hang' },
  ];

  const metricCards = [
    {
      label: 'Don dang xu ly',
      value: dashboard?.activeOrders ?? dashboard?.ordersInProgress ?? dashboard?.totalActiveOrders ?? 0,
    },
    {
      label: 'Doanh thu hom nay',
      value: (dashboard?.todayRevenue ?? dashboard?.dailyRevenue ?? 0).toLocaleString(),
    },
    {
      label: 'Khach hom nay',
      value: dashboard?.todayCustomers ?? dashboard?.customerCount ?? 0,
    },
    {
      label: 'Nhan su online',
      value: dashboard?.workingStaff ?? dashboard?.onlineStaff ?? 0,
    },
  ];

  return (
    <View style={styles.screenContainer}>
      <ScreenBackdrop />
      <ScrollView
        style={styles.screenScroll}
        contentContainerStyle={styles.screenContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void fetchDashboardData(true)} />}
      >
        <View style={styles.screenStack}>
          <Text style={styles.sectionTitle}>Bang Dieu Khien Chu Quan</Text>

          {loadError ? <ErrorStateView message={loadError} onRetry={() => void fetchDashboardData()} /> : null}

          {!loadError ? (
            <View style={styles.metricGrid}>
              {metricCards.map((metric) => (
                <View key={metric.label} style={[styles.glassCard, styles.metricCard]}>
                  <Text style={styles.metricLabel}>{metric.label}</Text>
                  <Text style={styles.metricValue}>{metric.value}</Text>
                </View>
              ))}
            </View>
          ) : null}

          <Text style={styles.sectionTitle}>Module Quan Ly</Text>

          <View style={styles.moduleGrid}>
            {modules.map((moduleCard) => {
              const isDisabled = !moduleCard.routeName;
              return (
                <TouchableOpacity
                  key={moduleCard.key}
                  activeOpacity={isDisabled ? 1 : 0.8}
                  disabled={isDisabled}
                  style={[styles.glassCard, styles.moduleCard, isDisabled ? styles.moduleCardDisabled : null]}
                  onPress={() => {
                    if (!moduleCard.routeName) return;
                    navigation.navigate(moduleCard.routeName);
                  }}
                >
                  <Text style={styles.moduleLabel}>{moduleCard.label}</Text>
                  {isDisabled ? (
                    <View style={styles.moduleBadge}>
                      <Text style={styles.moduleBadgeText}>Chua trien khai</Text>
                    </View>
                  ) : (
                    <Text style={styles.moduleMeta}>Mo module</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function getInventoryStockStatus(item: InventoryItem): InventoryFilterStatus {
  if (item.stock <= 0) return 'OUT_OF_STOCK';
  if (item.stock < item.minStockLevel) return 'LOW_STOCK';
  return 'AVAILABLE';
}

function InventoryScreen() {
  const { user } = useAuth();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [screenLoading, setScreenLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<InventoryFilterStatus>('ALL');
  const [statusSummary, setStatusSummary] = useState<any>(null);

  const [formMode, setFormMode] = useState<'create' | 'edit' | null>(null);
  const [editingItemId, setEditingItemId] = useState('');
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState<InventoryCategory>('DRINK');
  const [formUnit, setFormUnit] = useState('');
  const [formStock, setFormStock] = useState('');
  const [formThreshold, setFormThreshold] = useState('');
  const [formCostPrice, setFormCostPrice] = useState('0');
  const [formSellingPrice, setFormSellingPrice] = useState('0');
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const [adjustingItem, setAdjustingItem] = useState<InventoryItem | null>(null);
  const [adjustType, setAdjustType] = useState<InventoryStockAction>('INCREASE');
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustReason, setAdjustReason] = useState<(typeof INVENTORY_ADJUST_REASONS)[number] | ''>('');
  const [adjustSubmitting, setAdjustSubmitting] = useState(false);
  const [adjustError, setAdjustError] = useState('');

  const fetchInventoryData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setScreenLoading(true);
      }
      setLoadError('');

      const [itemsRes, summaryRes] = await Promise.all([getInventoryItems(), getInventoryStatusSummary()]);
      setItems(itemsRes);
      setStatusSummary(summaryRes);
    } catch (err: any) {
      setLoadError(err.response?.data?.message || 'Khong the tai du lieu kho');
    } finally {
      setScreenLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchInventoryData();
  }, [fetchInventoryData]);

  const resetForm = useCallback(() => {
    setFormMode(null);
    setEditingItemId('');
    setFormName('');
    setFormCategory('DRINK');
    setFormUnit('');
    setFormStock('');
    setFormThreshold('');
    setFormCostPrice('0');
    setFormSellingPrice('0');
    setFormError('');
  }, []);

  const openCreateForm = useCallback(() => {
    setFormMode('create');
    setEditingItemId('');
    setFormName('');
    setFormCategory('DRINK');
    setFormUnit('');
    setFormStock('0');
    setFormThreshold('10');
    setFormCostPrice('0');
    setFormSellingPrice('0');
    setFormError('');
    setAdjustingItem(null);
  }, []);

  const openEditForm = useCallback((item: InventoryItem) => {
    setFormMode('edit');
    setEditingItemId(item._id);
    setFormName(item.name);
    setFormCategory(item.category);
    setFormUnit(item.unit);
    setFormStock(String(item.stock ?? 0));
    setFormThreshold(String(item.minStockLevel ?? 0));
    setFormCostPrice(String(item.costPrice ?? 0));
    setFormSellingPrice(String(item.sellingPrice ?? 0));
    setFormError('');
    setAdjustingItem(null);
  }, []);

  const saveForm = useCallback(async () => {
    const normalizedName = formName.trim();
    const normalizedUnit = formUnit.trim();
    const stockValue = Number(formStock);
    const thresholdValue = Number(formThreshold);
    const costPriceValue = Number(formCostPrice);
    const sellingPriceValue = Number(formSellingPrice);

    if (!normalizedName) {
      setFormError('Ten nguyen lieu la bat buoc');
      return;
    }
    if (!normalizedUnit) {
      setFormError('Don vi tinh la bat buoc');
      return;
    }
    if (!Number.isFinite(stockValue) || stockValue < 0) {
      setFormError('So luong ton kho phai la so khong am');
      return;
    }
    if (!Number.isFinite(thresholdValue) || thresholdValue < 0) {
      setFormError('Nguong ton toi thieu phai la so khong am');
      return;
    }
    if (!Number.isFinite(costPriceValue) || costPriceValue < 0) {
      setFormError('Gia von phai la so khong am');
      return;
    }
    if (!Number.isFinite(sellingPriceValue) || sellingPriceValue < 0) {
      setFormError('Gia ban phai la so khong am');
      return;
    }

    setFormSubmitting(true);
    setFormError('');
    try {
      const payload = {
        name: normalizedName,
        category: formCategory,
        unit: normalizedUnit,
        stock: stockValue,
        minStockLevel: thresholdValue,
        costPrice: costPriceValue,
        sellingPrice: sellingPriceValue,
      };

      if (formMode === 'create') {
        await createInventoryItem(payload);
      } else if (formMode === 'edit' && editingItemId) {
        await updateInventoryItem(editingItemId, payload);
      }

      resetForm();
      void fetchInventoryData(true);
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Khong the luu nguyen lieu');
    } finally {
      setFormSubmitting(false);
    }
  }, [
    editingItemId,
    fetchInventoryData,
    formCategory,
    formCostPrice,
    formMode,
    formName,
    formSellingPrice,
    formStock,
    formThreshold,
    formUnit,
    resetForm,
  ]);

  const confirmDeleteItem = useCallback((item: InventoryItem) => {
    Alert.alert('Xoa nguyen lieu', `Ban chac chan muon xoa "${item.name}"?`, [
      { text: 'Huy', style: 'cancel' },
      {
        text: 'Xoa',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteInventoryItem(item._id);
            void fetchInventoryData(true);
          } catch (err: any) {
            Alert.alert('Khong the xoa', err.response?.data?.message || 'Xoa nguyen lieu that bai');
          }
        },
      },
    ]);
  }, [fetchInventoryData]);

  const openAdjustPanel = useCallback((item: InventoryItem) => {
    setAdjustingItem(item);
    setAdjustType('INCREASE');
    setAdjustAmount('');
    setAdjustReason('');
    setAdjustError('');
    setFormMode(null);
  }, []);

  const applyStockAdjustment = useCallback(async () => {
    if (!adjustingItem) return;

    const amount = Number(adjustAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setAdjustError('So luong dieu chinh phai lon hon 0');
      return;
    }
    if (!adjustReason) {
      setAdjustError('Vui long chon ly do dieu chinh');
      return;
    }

    const nextStock = adjustType === 'INCREASE' ? adjustingItem.stock + amount : adjustingItem.stock - amount;
    if (nextStock < 0) {
      setAdjustError('Khong the giam ton kho xuong duoi 0');
      return;
    }

    setAdjustSubmitting(true);
    setAdjustError('');
    try {
      await updateInventoryItem(adjustingItem._id, { stock: nextStock });
      setAdjustingItem(null);
      void fetchInventoryData(true);
      Alert.alert('Thanh cong', `Da cap nhat ton kho. Ly do: ${adjustReason}`);
    } catch (err: any) {
      setAdjustError(err.response?.data?.message || 'Khong the dieu chinh ton kho');
    } finally {
      setAdjustSubmitting(false);
    }
  }, [adjustAmount, adjustReason, adjustType, adjustingItem, fetchInventoryData]);

  if (!user || !MANAGEMENT_ROLES.includes(user.role)) {
    return (
      <View style={styles.screenContainer}>
        <ScreenBackdrop />
        <RestrictedStateView message="Ban khong co quyen truy cap man hinh kho." />
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

  const keyword = search.trim().toLowerCase();
  const filteredItems = items.filter((item) => {
    if (keyword && !item.name.toLowerCase().includes(keyword)) {
      return false;
    }
    if (statusFilter === 'ALL') {
      return true;
    }
    return getInventoryStockStatus(item) === statusFilter;
  });

  return (
    <View style={styles.screenContainer}>
      <ScreenBackdrop />
      <ScrollView
        style={styles.screenScroll}
        contentContainerStyle={styles.screenContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void fetchInventoryData(true)} />}
      >
        <View style={styles.screenStack}>
          <Text style={styles.sectionTitle}>Quan Ly Kho</Text>

          {statusSummary ? (
            <View style={styles.metricGrid}>
              <View style={[styles.glassCard, styles.metricCard]}>
                <Text style={styles.metricLabel}>Tong nguyen lieu</Text>
                <Text style={styles.metricValue}>{statusSummary.totalItems ?? items.length}</Text>
              </View>
              <View style={[styles.glassCard, styles.metricCard]}>
                <Text style={styles.metricLabel}>Sap het hang</Text>
                <Text style={styles.metricValue}>{statusSummary.lowStockCount ?? 0}</Text>
              </View>
            </View>
          ) : null}

          <View style={[styles.glassCard, styles.inventoryToolbar]}>
            <TextInput
              placeholder="Tim theo ten nguyen lieu"
              value={search}
              onChangeText={setSearch}
              placeholderTextColor={COLORS.textMuted}
              style={styles.input}
            />

            <View style={styles.filterRow}>
              {INVENTORY_FILTER_OPTIONS.map((option) => {
                const selected = statusFilter === option;
                return (
                  <TouchableOpacity
                    key={option}
                    activeOpacity={0.8}
                    style={[styles.filterChip, selected ? styles.filterChipActive : null]}
                    onPress={() => setStatusFilter(option)}
                  >
                    <Text style={[styles.filterChipText, selected ? styles.filterChipTextActive : null]}>{option}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity activeOpacity={0.8} style={[styles.buttonBase, styles.buttonPrimary]} onPress={openCreateForm}>
              <Text style={styles.buttonText}>Them Nguyen Lieu</Text>
            </TouchableOpacity>
          </View>

          {formMode ? (
            <View style={[styles.glassCard, styles.formCard]}>
              <Text style={styles.sectionTitle}>{formMode === 'create' ? 'Tao Nguyen Lieu' : 'Cap Nhat Nguyen Lieu'}</Text>
              {formError ? <Text style={styles.errorText}>{formError}</Text> : null}

              <TextInput placeholder="Ten" value={formName} onChangeText={setFormName} placeholderTextColor={COLORS.textMuted} style={styles.input} />
              <TextInput
                placeholder="Don vi tinh (kg, g, ml...)"
                value={formUnit}
                onChangeText={setFormUnit}
                placeholderTextColor={COLORS.textMuted}
                style={styles.input}
              />
              <TextInput
                placeholder="So luong ton kho"
                value={formStock}
                onChangeText={setFormStock}
                keyboardType="decimal-pad"
                placeholderTextColor={COLORS.textMuted}
                style={styles.input}
              />
              <TextInput
                placeholder="Nguong sap het hang"
                value={formThreshold}
                onChangeText={setFormThreshold}
                keyboardType="decimal-pad"
                placeholderTextColor={COLORS.textMuted}
                style={styles.input}
              />
              <TextInput
                placeholder="Gia von (bat buoc theo backend)"
                value={formCostPrice}
                onChangeText={setFormCostPrice}
                keyboardType="decimal-pad"
                placeholderTextColor={COLORS.textMuted}
                style={styles.input}
              />
              <TextInput
                placeholder="Gia ban (bat buoc theo backend)"
                value={formSellingPrice}
                onChangeText={setFormSellingPrice}
                keyboardType="decimal-pad"
                placeholderTextColor={COLORS.textMuted}
                style={styles.input}
              />

              <View style={styles.filterRow}>
                {INVENTORY_CATEGORY_OPTIONS.map((category) => {
                  const selected = formCategory === category;
                  return (
                    <TouchableOpacity
                      key={category}
                      activeOpacity={0.8}
                      style={[styles.filterChip, selected ? styles.filterChipActive : null]}
                      onPress={() => setFormCategory(category)}
                    >
                      <Text style={[styles.filterChipText, selected ? styles.filterChipTextActive : null]}>{category}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.rowSplit}>
                <TouchableOpacity activeOpacity={0.8} style={[styles.buttonBase, styles.buttonSecondary, styles.flex1]} onPress={resetForm}>
                  <Text style={styles.buttonText}>Huy</Text>
                </TouchableOpacity>
                <TouchableOpacity activeOpacity={0.8} style={[styles.buttonBase, styles.buttonPrimary, styles.flex1]} onPress={() => void saveForm()}>
                  {formSubmitting ? <ActivityIndicator color={COLORS.text} /> : <Text style={styles.buttonText}>Luu</Text>}
                </TouchableOpacity>
              </View>
            </View>
          ) : null}

          {adjustingItem ? (
            <View style={[styles.glassCard, styles.formCard]}>
              <Text style={styles.sectionTitle}>Dieu Chinh Ton Kho: {adjustingItem.name}</Text>
              {adjustError ? <Text style={styles.errorText}>{adjustError}</Text> : null}

              <Text style={styles.helperText}>Ton hien tai: {adjustingItem.stock} {adjustingItem.unit}</Text>
              <Text style={styles.helperText}>Luu y: backend hien tai khong luu tru ly do dieu chinh.</Text>

              <View style={styles.filterRow}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  style={[styles.filterChip, adjustType === 'INCREASE' ? styles.filterChipActive : null]}
                  onPress={() => setAdjustType('INCREASE')}
                >
                  <Text style={[styles.filterChipText, adjustType === 'INCREASE' ? styles.filterChipTextActive : null]}>Tang</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.8}
                  style={[styles.filterChip, adjustType === 'DECREASE' ? styles.filterChipActive : null]}
                  onPress={() => setAdjustType('DECREASE')}
                >
                  <Text style={[styles.filterChipText, adjustType === 'DECREASE' ? styles.filterChipTextActive : null]}>Giam</Text>
                </TouchableOpacity>
              </View>

              <TextInput
                placeholder="So luong dieu chinh"
                value={adjustAmount}
                onChangeText={setAdjustAmount}
                keyboardType="decimal-pad"
                placeholderTextColor={COLORS.textMuted}
                style={styles.input}
              />

              <View style={styles.filterRow}>
                {INVENTORY_ADJUST_REASONS.map((reason) => {
                  const selected = adjustReason === reason;
                  return (
                    <TouchableOpacity
                      key={reason}
                      activeOpacity={0.8}
                      style={[styles.filterChip, selected ? styles.filterChipActive : null]}
                      onPress={() => setAdjustReason(reason)}
                    >
                      <Text style={[styles.filterChipText, selected ? styles.filterChipTextActive : null]}>{reason}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.rowSplit}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  style={[styles.buttonBase, styles.buttonSecondary, styles.flex1]}
                  onPress={() => setAdjustingItem(null)}
                >
                  <Text style={styles.buttonText}>Huy</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.8}
                  style={[styles.buttonBase, styles.buttonPrimary, styles.flex1]}
                  onPress={() => void applyStockAdjustment()}
                >
                  {adjustSubmitting ? <ActivityIndicator color={COLORS.text} /> : <Text style={styles.buttonText}>Xac Nhan</Text>}
                </TouchableOpacity>
              </View>
            </View>
          ) : null}

          {loadError ? <ErrorStateView message={loadError} onRetry={() => void fetchInventoryData()} /> : null}

          {!loadError && filteredItems.length === 0 ? (
            <EmptyStateView message="Khong co nguyen lieu nao trong kho." />
          ) : (
            filteredItems.map((item) => {
              const stockStatus = getInventoryStockStatus(item);
              const statusStyle =
                stockStatus === 'OUT_OF_STOCK'
                  ? styles.statusPending
                  : stockStatus === 'LOW_STOCK'
                    ? styles.statusLowStock
                    : styles.statusProgress;

              return (
                <View key={item._id} style={[styles.glassCard, styles.inventoryItemCard]}>
                  <View style={styles.staffHeader}>
                    <View style={styles.staffInfo}>
                      <Text style={styles.staffName}>{item.name}</Text>
                      <Text style={styles.staffMeta}>Danh muc: {item.category}</Text>
                      <Text style={styles.staffMeta}>
                        Ton kho: {item.stock} {item.unit}
                      </Text>
                      <Text style={styles.staffMeta}>Nguong: {item.minStockLevel}</Text>
                    </View>
                    <View style={[styles.statusBadge, statusStyle]}>
                      <Text style={styles.statusText}>{stockStatus}</Text>
                    </View>
                  </View>

                  <View style={styles.inventoryActionRow}>
                    <TouchableOpacity activeOpacity={0.8} style={[styles.buttonBase, styles.buttonSecondary, styles.flex1]} onPress={() => openEditForm(item)}>
                      <Text style={styles.buttonText}>Sua</Text>
                    </TouchableOpacity>
                    <TouchableOpacity activeOpacity={0.8} style={[styles.buttonBase, styles.buttonPrimary, styles.flex1]} onPress={() => openAdjustPanel(item)}>
                      <Text style={styles.buttonText}>Dieu Chinh Ton</Text>
                    </TouchableOpacity>
                    <TouchableOpacity activeOpacity={0.8} style={[styles.buttonBase, styles.buttonAmber, styles.flex1]} onPress={() => confirmDeleteItem(item)}>
                      <Text style={styles.buttonText}>Xoa</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function getMenuViewStatus(item: InventoryItem): MenuViewStatus {
  if (item.status !== 'ACTIVE') return 'INACTIVE';
  if (item.stock <= 0) return 'OUT_OF_STOCK';
  return 'AVAILABLE';
}

function getMenuStatusLabel(status: MenuViewStatus) {
  if (status === 'INACTIVE') return 'Tam ngung';
  if (status === 'OUT_OF_STOCK') return 'Het mon';
  return 'Dang ban';
}

function getMenuFilterLabel(status: MenuViewStatus | 'ALL') {
  if (status === 'ALL') return 'Tat ca';
  return getMenuStatusLabel(status);
}

function MenuManagementScreen() {
  const { user } = useAuth();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [screenLoading, setScreenLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<InventoryCategory | 'ALL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<MenuViewStatus | 'ALL'>('ALL');

  const [formMode, setFormMode] = useState<'create' | 'edit' | null>(null);
  const [editingItemId, setEditingItemId] = useState('');
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState<InventoryCategory>('DRINK');
  const [formUnit, setFormUnit] = useState('');
  const [formSellingPrice, setFormSellingPrice] = useState('');
  const [formCostPrice, setFormCostPrice] = useState('');
  const [formStock, setFormStock] = useState('0');
  const [formMinStock, setFormMinStock] = useState('0');
  const [formImageUrl, setFormImageUrl] = useState('');
  const [formStatus, setFormStatus] = useState<'ACTIVE' | 'HIDDEN'>('ACTIVE');
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const fetchMenuData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setScreenLoading(true);
      }
      setLoadError('');
      const menuItems = await getInventoryItems();
      setItems(menuItems);
    } catch (err: any) {
      setLoadError(err.response?.data?.message || 'Khong the tai danh sach menu');
    } finally {
      setScreenLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchMenuData();
  }, [fetchMenuData]);

  const resetForm = useCallback(() => {
    setFormMode(null);
    setEditingItemId('');
    setFormName('');
    setFormCategory('DRINK');
    setFormUnit('');
    setFormSellingPrice('');
    setFormCostPrice('');
    setFormStock('0');
    setFormMinStock('0');
    setFormImageUrl('');
    setFormStatus('ACTIVE');
    setFormError('');
  }, []);

  const openCreateForm = useCallback(() => {
    setFormMode('create');
    setEditingItemId('');
    setFormName('');
    setFormCategory('DRINK');
    setFormUnit('ly');
    setFormSellingPrice('');
    setFormCostPrice('0');
    setFormStock('0');
    setFormMinStock('0');
    setFormImageUrl('');
    setFormStatus('ACTIVE');
    setFormError('');
  }, []);

  const openEditForm = useCallback((item: InventoryItem) => {
    setFormMode('edit');
    setEditingItemId(item._id);
    setFormName(item.name);
    setFormCategory(item.category);
    setFormUnit(item.unit || '');
    setFormSellingPrice(String(item.sellingPrice ?? 0));
    setFormCostPrice(String(item.costPrice ?? 0));
    setFormStock(String(item.stock ?? 0));
    setFormMinStock(String(item.minStockLevel ?? 0));
    setFormImageUrl(item.imageUrl || '');
    setFormStatus(item.status === 'ACTIVE' ? 'ACTIVE' : 'HIDDEN');
    setFormError('');
  }, []);

  const saveMenuItem = useCallback(async () => {
    const name = formName.trim();
    const unit = formUnit.trim();
    const sellingPrice = Number(formSellingPrice);
    const costPrice = Number(formCostPrice);
    const stock = Number(formStock);
    const minStockLevel = Number(formMinStock);
    const imageUrl = formImageUrl.trim();

    if (!name) {
      setFormError('Ten mon la bat buoc');
      return;
    }
    if (!unit) {
      setFormError('Don vi tinh la bat buoc');
      return;
    }
    if (!Number.isFinite(sellingPrice) || sellingPrice < 0) {
      setFormError('Gia ban phai la so khong am');
      return;
    }
    if (!Number.isFinite(costPrice) || costPrice < 0) {
      setFormError('Gia von phai la so khong am');
      return;
    }
    if (!Number.isFinite(stock) || stock < 0) {
      setFormError('So luong ton kho phai la so khong am');
      return;
    }
    if (!Number.isFinite(minStockLevel) || minStockLevel < 0) {
      setFormError('Nguong ton toi thieu phai la so khong am');
      return;
    }

    setFormSubmitting(true);
    setFormError('');
    try {
      const payload = {
        name,
        category: formCategory,
        sellingPrice,
        costPrice,
        stock,
        minStockLevel,
        unit,
        status: formStatus,
        imageUrl: imageUrl || undefined,
      };

      if (formMode === 'create') {
        await createInventoryItem(payload);
      } else if (formMode === 'edit' && editingItemId) {
        await updateInventoryItem(editingItemId, payload);
      }

      resetForm();
      void fetchMenuData(true);
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Khong the luu mon');
    } finally {
      setFormSubmitting(false);
    }
  }, [
    editingItemId,
    fetchMenuData,
    formCategory,
    formCostPrice,
    formImageUrl,
    formMinStock,
    formMode,
    formName,
    formSellingPrice,
    formStatus,
    formStock,
    formUnit,
    resetForm,
  ]);

  const toggleMenuStatus = useCallback((item: InventoryItem) => {
    const isActive = item.status === 'ACTIVE';
    Alert.alert(
      isActive ? 'Tam ngung mon' : 'Mo ban lai mon',
      isActive ? `Ban muon tam ngung mon "${item.name}"?` : `Ban muon cho mon "${item.name}" ban lai?`,
      [
        { text: 'Huy', style: 'cancel' },
        {
          text: 'Xac nhan',
          onPress: async () => {
            try {
              await updateInventoryItem(item._id, { status: isActive ? 'HIDDEN' : 'ACTIVE' });
              void fetchMenuData(true);
            } catch (err: any) {
              Alert.alert('Loi', err.response?.data?.message || 'Khong the cap nhat trang thai mon');
            }
          },
        },
      ],
    );
  }, [fetchMenuData]);

  const confirmDeleteMenuItem = useCallback((item: InventoryItem) => {
    Alert.alert('Xoa mon', `Ban chac chan muon xoa mon "${item.name}"?`, [
      { text: 'Huy', style: 'cancel' },
      {
        text: 'Xoa mon',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteInventoryItem(item._id);
            void fetchMenuData(true);
          } catch (err: any) {
            Alert.alert('Khong the xoa', err.response?.data?.message || 'Xoa mon that bai');
          }
        },
      },
    ]);
  }, [fetchMenuData]);

  if (!user || !MANAGEMENT_ROLES.includes(user.role)) {
    return (
      <View style={styles.screenContainer}>
        <ScreenBackdrop />
        <RestrictedStateView message="Ban khong co quyen truy cap man hinh menu." />
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

  const keyword = search.trim().toLowerCase();
  const filteredItems = items.filter((item) => {
    if (keyword && !item.name.toLowerCase().includes(keyword)) {
      return false;
    }
    if (categoryFilter !== 'ALL' && item.category !== categoryFilter) {
      return false;
    }
    const viewStatus = getMenuViewStatus(item);
    if (statusFilter !== 'ALL' && viewStatus !== statusFilter) {
      return false;
    }
    return true;
  });

  const availableCount = items.filter((item) => getMenuViewStatus(item) === 'AVAILABLE').length;
  const outOfStockCount = items.filter((item) => getMenuViewStatus(item) === 'OUT_OF_STOCK').length;
  const inactiveCount = items.filter((item) => getMenuViewStatus(item) === 'INACTIVE').length;

  return (
    <View style={styles.screenContainer}>
      <ScreenBackdrop />
      <ScrollView
        style={styles.screenScroll}
        contentContainerStyle={styles.screenContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void fetchMenuData(true)} />}
      >
        <View style={styles.screenStack}>
          <Text style={styles.sectionTitle}>Quan ly menu</Text>

          <View style={styles.metricGrid}>
            <View style={[styles.glassCard, styles.metricCard]}>
              <Text style={styles.metricLabel}>Dang ban</Text>
              <Text style={styles.metricValue}>{availableCount}</Text>
            </View>
            <View style={[styles.glassCard, styles.metricCard]}>
              <Text style={styles.metricLabel}>Het mon</Text>
              <Text style={styles.metricValue}>{outOfStockCount}</Text>
            </View>
            <View style={[styles.glassCard, styles.metricCard]}>
              <Text style={styles.metricLabel}>Tam ngung</Text>
              <Text style={styles.metricValue}>{inactiveCount}</Text>
            </View>
          </View>

          <View style={[styles.glassCard, styles.inventoryToolbar]}>
            <TextInput
              placeholder="Tim theo ten mon"
              value={search}
              onChangeText={setSearch}
              placeholderTextColor={COLORS.textMuted}
              style={styles.input}
            />

            <Text style={styles.helperText}>Loc theo danh muc</Text>
            <View style={styles.filterRow}>
              <TouchableOpacity
                activeOpacity={0.8}
                style={[styles.filterChip, categoryFilter === 'ALL' ? styles.filterChipActive : null]}
                onPress={() => setCategoryFilter('ALL')}
              >
                <Text style={[styles.filterChipText, categoryFilter === 'ALL' ? styles.filterChipTextActive : null]}>ALL</Text>
              </TouchableOpacity>
              {INVENTORY_CATEGORY_OPTIONS.map((category) => {
                const selected = categoryFilter === category;
                return (
                  <TouchableOpacity
                    key={category}
                    activeOpacity={0.8}
                    style={[styles.filterChip, selected ? styles.filterChipActive : null]}
                    onPress={() => setCategoryFilter(category)}
                  >
                    <Text style={[styles.filterChipText, selected ? styles.filterChipTextActive : null]}>{category}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.helperText}>Loc theo trang thai</Text>
            <View style={styles.filterRow}>
              {MENU_STATUS_FILTER_OPTIONS.map((option) => {
                const selected = statusFilter === option;
                return (
                  <TouchableOpacity
                    key={option}
                    activeOpacity={0.8}
                    style={[styles.filterChip, selected ? styles.filterChipActive : null]}
                    onPress={() => setStatusFilter(option)}
                  >
                    <Text style={[styles.filterChipText, selected ? styles.filterChipTextActive : null]}>{getMenuFilterLabel(option)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity activeOpacity={0.8} style={[styles.buttonBase, styles.buttonPrimary]} onPress={openCreateForm}>
              <Text style={styles.buttonText}>Them mon</Text>
            </TouchableOpacity>
          </View>

          {formMode ? (
            <View style={[styles.glassCard, styles.formCard]}>
              <Text style={styles.sectionTitle}>{formMode === 'create' ? 'Them mon' : 'Sua mon'}</Text>
              {formError ? <Text style={styles.errorText}>{formError}</Text> : null}

              <TextInput placeholder="Ten mon" value={formName} onChangeText={setFormName} placeholderTextColor={COLORS.textMuted} style={styles.input} />
              <TextInput
                placeholder="Don vi tinh (backend bat buoc)"
                value={formUnit}
                onChangeText={setFormUnit}
                placeholderTextColor={COLORS.textMuted}
                style={styles.input}
              />
              <TextInput
                placeholder="Gia ban"
                value={formSellingPrice}
                onChangeText={setFormSellingPrice}
                keyboardType="decimal-pad"
                placeholderTextColor={COLORS.textMuted}
                style={styles.input}
              />
              <TextInput
                placeholder="Gia von (backend bat buoc)"
                value={formCostPrice}
                onChangeText={setFormCostPrice}
                keyboardType="decimal-pad"
                placeholderTextColor={COLORS.textMuted}
                style={styles.input}
              />
              <TextInput
                placeholder="So luong ton kho"
                value={formStock}
                onChangeText={setFormStock}
                keyboardType="decimal-pad"
                placeholderTextColor={COLORS.textMuted}
                style={styles.input}
              />
              <TextInput
                placeholder="Nguong canh bao het mon"
                value={formMinStock}
                onChangeText={setFormMinStock}
                keyboardType="decimal-pad"
                placeholderTextColor={COLORS.textMuted}
                style={styles.input}
              />
              <TextInput
                placeholder="Image URL (neu co)"
                value={formImageUrl}
                onChangeText={setFormImageUrl}
                placeholderTextColor={COLORS.textMuted}
                style={styles.input}
              />

              <Text style={styles.helperText}>Danh muc</Text>
              <View style={styles.filterRow}>
                {INVENTORY_CATEGORY_OPTIONS.map((category) => {
                  const selected = formCategory === category;
                  return (
                    <TouchableOpacity
                      key={category}
                      activeOpacity={0.8}
                      style={[styles.filterChip, selected ? styles.filterChipActive : null]}
                      onPress={() => setFormCategory(category)}
                    >
                      <Text style={[styles.filterChipText, selected ? styles.filterChipTextActive : null]}>{category}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.helperText}>Trang thai ban</Text>
              <View style={styles.filterRow}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  style={[styles.filterChip, formStatus === 'ACTIVE' ? styles.filterChipActive : null]}
                  onPress={() => setFormStatus('ACTIVE')}
                >
                  <Text style={[styles.filterChipText, formStatus === 'ACTIVE' ? styles.filterChipTextActive : null]}>Dang ban</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.8}
                  style={[styles.filterChip, formStatus === 'HIDDEN' ? styles.filterChipActive : null]}
                  onPress={() => setFormStatus('HIDDEN')}
                >
                  <Text style={[styles.filterChipText, formStatus === 'HIDDEN' ? styles.filterChipTextActive : null]}>Tam ngung</Text>
                </TouchableOpacity>
              </View>

              <View style={[styles.glassCard, styles.disabledBlock]}>
                <Text style={styles.sectionTitle}>Mo ta mon</Text>
                <Text style={styles.helperText}>Backend chua ho tro truong mo ta cho mon.</Text>
              </View>

              <View style={[styles.glassCard, styles.disabledBlock]}>
                <Text style={styles.sectionTitle}>Nguyen lieu su dung</Text>
                <Text style={styles.helperText}>Backend chua ho tro lien ket mon voi nguyen lieu.</Text>
              </View>

              <View style={styles.rowSplit}>
                <TouchableOpacity activeOpacity={0.8} style={[styles.buttonBase, styles.buttonSecondary, styles.flex1]} onPress={resetForm}>
                  <Text style={styles.buttonText}>Huy</Text>
                </TouchableOpacity>
                <TouchableOpacity activeOpacity={0.8} style={[styles.buttonBase, styles.buttonPrimary, styles.flex1]} onPress={() => void saveMenuItem()}>
                  {formSubmitting ? <ActivityIndicator color={COLORS.text} /> : <Text style={styles.buttonText}>Luu mon</Text>}
                </TouchableOpacity>
              </View>
            </View>
          ) : null}

          {loadError ? <ErrorStateView message={loadError} onRetry={() => void fetchMenuData()} /> : null}

          {!loadError && filteredItems.length === 0 ? (
            <EmptyStateView message="Chua co mon nao trong menu." />
          ) : (
            filteredItems.map((item) => {
              const viewStatus = getMenuViewStatus(item);
              const statusStyle =
                viewStatus === 'INACTIVE' ? styles.statusPending : viewStatus === 'OUT_OF_STOCK' ? styles.statusLowStock : styles.statusProgress;
              const ingredientCount = Array.isArray((item as any).ingredients) ? (item as any).ingredients.length : null;

              return (
                <View key={item._id} style={[styles.glassCard, styles.inventoryItemCard]}>
                  <View style={styles.staffHeader}>
                    <View style={styles.staffInfo}>
                      <Text style={styles.staffName}>{item.name}</Text>
                      <Text style={styles.staffMeta}>Danh muc: {item.category}</Text>
                      <Text style={styles.staffMeta}>Gia ban: {(item.sellingPrice || 0).toLocaleString()}d</Text>
                      {(item as any).description ? <Text style={styles.staffMeta}>Mo ta: {(item as any).description}</Text> : null}
                      {item.imageUrl ? <Text style={styles.staffMeta}>Anh: {item.imageUrl}</Text> : null}
                      <Text style={styles.staffMeta}>
                        Ton kho hien tai: {item.stock} {item.unit}
                      </Text>
                      <Text style={styles.staffMeta}>
                        Nguyen lieu su dung: {ingredientCount === null ? 'Backend chua ho tro' : ingredientCount}
                      </Text>
                    </View>
                    <View style={[styles.statusBadge, statusStyle]}>
                      <Text style={styles.statusText}>{getMenuStatusLabel(viewStatus)}</Text>
                    </View>
                  </View>

                  <View style={styles.inventoryActionRow}>
                    <TouchableOpacity activeOpacity={0.8} style={[styles.buttonBase, styles.buttonSecondary, styles.flex1]} onPress={() => openEditForm(item)}>
                      <Text style={styles.buttonText}>Sua mon</Text>
                    </TouchableOpacity>
                    <TouchableOpacity activeOpacity={0.8} style={[styles.buttonBase, styles.buttonPrimary, styles.flex1]} onPress={() => toggleMenuStatus(item)}>
                      <Text style={styles.buttonText}>{item.status === 'ACTIVE' ? 'Tam ngung' : 'Dang ban'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity activeOpacity={0.8} style={[styles.buttonBase, styles.buttonAmber, styles.flex1]} onPress={() => confirmDeleteMenuItem(item)}>
                      <Text style={styles.buttonText}>Xoa mon</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function getTableViewStatus(table: DiningTable): TableViewStatus {
  if (table.isHidden) return 'DISABLED';
  if (table.status === 'EMPTY') return 'AVAILABLE';
  return 'ACTIVE';
}

function getTableViewStatusLabel(viewStatus: TableViewStatus) {
  if (viewStatus === 'AVAILABLE') return 'Con trong';
  if (viewStatus === 'ACTIVE') return 'Dang hoat dong';
  return 'Tam ngung';
}

function getTableFilterLabel(filter: TableViewStatus | 'ALL') {
  if (filter === 'ALL') return 'Tat ca';
  return getTableViewStatusLabel(filter);
}

function parseTableName(tableName: string) {
  const normalized = tableName.trim();
  const numberMatch = normalized.match(/\d+/);
  const tableNumber = numberMatch ? numberMatch[0] : '';
  const isGeneratedName = /^ban\s*\d+$/i.test(normalized);
  return {
    tableNumber,
    displayName: isGeneratedName ? '' : normalized,
  };
}

function buildTableName(tableNumber: string, displayName: string) {
  const normalizedDisplay = displayName.trim();
  if (normalizedDisplay) return normalizedDisplay;
  return `Ban ${tableNumber.trim()}`;
}

function TableManagementScreen() {
  const { user } = useAuth();
  const [tables, setTables] = useState<DiningTable[]>([]);
  const [activeOrderCountByTable, setActiveOrderCountByTable] = useState<Record<string, number>>({});
  const [screenLoading, setScreenLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<TableViewStatus | 'ALL'>('ALL');

  const [formMode, setFormMode] = useState<'create' | 'edit' | null>(null);
  const [editingTable, setEditingTable] = useState<DiningTable | null>(null);
  const [formTableNumber, setFormTableNumber] = useState('');
  const [formDisplayName, setFormDisplayName] = useState('');
  const [formCapacity, setFormCapacity] = useState('');
  const [formLocation, setFormLocation] = useState('');
  const [formStatus, setFormStatus] = useState<TableViewStatus>('AVAILABLE');
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const [qrViewTable, setQrViewTable] = useState<DiningTable | null>(null);

  const fetchTableData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setScreenLoading(true);
      }
      setLoadError('');

      const tableRows = await getTables();
      setTables(tableRows);

      try {
        const activeOrdersRes = await api.get('/orders/active');
        const orders = Array.isArray(activeOrdersRes.data) ? activeOrdersRes.data : [];
        const grouped: Record<string, number> = {};

        orders.forEach((order: any) => {
          const tableId = typeof order.tableId === 'string' ? order.tableId : order.tableId?._id;
          if (!tableId) return;
          grouped[tableId] = (grouped[tableId] || 0) + 1;
        });

        setActiveOrderCountByTable(grouped);
      } catch {
        setActiveOrderCountByTable({});
      }
    } catch (err: any) {
      setLoadError(err.response?.data?.message || 'Khong the tai danh sach ban');
    } finally {
      setScreenLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchTableData();
  }, [fetchTableData]);

  const resetForm = useCallback(() => {
    setFormMode(null);
    setEditingTable(null);
    setFormTableNumber('');
    setFormDisplayName('');
    setFormCapacity('');
    setFormLocation('');
    setFormStatus('AVAILABLE');
    setFormError('');
  }, []);

  const openCreateForm = useCallback(() => {
    setFormMode('create');
    setEditingTable(null);
    setFormTableNumber('');
    setFormDisplayName('');
    setFormCapacity('4');
    setFormLocation('');
    setFormStatus('AVAILABLE');
    setFormError('');
    setQrViewTable(null);
  }, []);

  const openEditForm = useCallback((table: DiningTable) => {
    const parsed = parseTableName(table.name || '');
    setFormMode('edit');
    setEditingTable(table);
    setFormTableNumber(parsed.tableNumber);
    setFormDisplayName(parsed.displayName);
    setFormCapacity(table.capacity ? String(table.capacity) : '');
    setFormLocation(table.location || '');
    setFormStatus(getTableViewStatus(table));
    setFormError('');
    setQrViewTable(null);
  }, []);

  const saveTableForm = useCallback(async () => {
    const tableNumber = formTableNumber.trim();
    if (!tableNumber) {
      setFormError('So ban la bat buoc');
      return;
    }
    if (!/^\d+$/.test(tableNumber)) {
      setFormError('So ban phai la so hop le');
      return;
    }

    const duplicateTable = tables.find((table) => {
      if (editingTable && table._id === editingTable._id) return false;
      return parseTableName(table.name).tableNumber === tableNumber;
    });
    if (duplicateTable) {
      setFormError('So ban da ton tai');
      return;
    }

    const tableName = buildTableName(tableNumber, formDisplayName);
    const capacityNum = formCapacity.trim() ? Number(formCapacity) : undefined;

    if (capacityNum !== undefined && (!Number.isFinite(capacityNum) || capacityNum <= 0)) {
      setFormError('Suc chua phai la so duong');
      return;
    }

    setFormSubmitting(true);
    setFormError('');
    try {
      const payload = {
        name: tableName,
        location: formLocation.trim() || undefined,
        capacity: capacityNum,
      };

      if (formMode === 'create') {
        const created = await createTable(payload);
        if (formStatus === 'DISABLED') {
          await toggleTableVisibility(created._id);
        } else if (formStatus === 'ACTIVE') {
          await updateTableStatus(created._id, 'SERVING');
        }
      } else if (formMode === 'edit' && editingTable) {
        await updateTable(editingTable._id, payload);

        const currentViewStatus = getTableViewStatus(editingTable);
        if (currentViewStatus !== formStatus) {
          if (formStatus === 'DISABLED' && !editingTable.isHidden) {
            await toggleTableVisibility(editingTable._id);
          } else if (formStatus !== 'DISABLED' && editingTable.isHidden) {
            await toggleTableVisibility(editingTable._id);
          }

          if (formStatus === 'AVAILABLE') {
            await updateTableStatus(editingTable._id, 'EMPTY');
          }

          if (formStatus === 'ACTIVE') {
            await updateTableStatus(editingTable._id, 'SERVING');
          }
        }
      }

      resetForm();
      void fetchTableData(true);
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Khong the luu thong tin ban');
    } finally {
      setFormSubmitting(false);
    }
  }, [editingTable, fetchTableData, formCapacity, formDisplayName, formLocation, formMode, formStatus, formTableNumber, resetForm, tables]);

  const confirmDeleteTable = useCallback((table: DiningTable) => {
    Alert.alert('Xoa ban', `Ban chac chan muon xoa ${table.name}?`, [
      { text: 'Huy', style: 'cancel' },
      {
        text: 'Xoa ban',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteTable(table._id);
            void fetchTableData(true);
          } catch (err: any) {
            Alert.alert('Khong the xoa ban', err.response?.data?.message || 'Xoa ban that bai');
          }
        },
      },
    ]);
  }, [fetchTableData]);

  const resetQrToken = useCallback((table: DiningTable) => {
    Alert.alert('Tao lai QR', `Ban muon tao lai QR cho ${table.name}?`, [
      { text: 'Huy', style: 'cancel' },
      {
        text: 'Tao lai',
        onPress: async () => {
          try {
            const updated = await resetTableQr(table._id);
            if (qrViewTable && qrViewTable._id === table._id) {
              setQrViewTable(updated);
            }
            void fetchTableData(true);
          } catch (err: any) {
            Alert.alert('Loi', err.response?.data?.message || 'Khong the tao lai QR');
          }
        },
      },
    ]);
  }, [fetchTableData, qrViewTable]);

  const toggleVisibility = useCallback((table: DiningTable) => {
    const willDisable = !table.isHidden;
    Alert.alert(
      willDisable ? 'Tam ngung ban' : 'Mo lai ban',
      willDisable ? `Ban muon tam ngung ${table.name}?` : `Ban muon mo lai ${table.name}?`,
      [
        { text: 'Huy', style: 'cancel' },
        {
          text: 'Xac nhan',
          onPress: async () => {
            try {
              await toggleTableVisibility(table._id);
              void fetchTableData(true);
            } catch (err: any) {
              Alert.alert('Loi', err.response?.data?.message || 'Khong the cap nhat trang thai ban');
            }
          },
        },
      ],
    );
  }, [fetchTableData]);

  if (!user || !MANAGEMENT_ROLES.includes(user.role)) {
    return (
      <View style={styles.screenContainer}>
        <ScreenBackdrop />
        <RestrictedStateView message="Ban khong co quyen truy cap man hinh ban." />
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

  const keyword = search.trim().toLowerCase();
  const filteredTables = tables.filter((table) => {
    const viewStatus = getTableViewStatus(table);
    if (statusFilter !== 'ALL' && viewStatus !== statusFilter) {
      return false;
    }
    if (keyword && !table.name.toLowerCase().includes(keyword)) {
      return false;
    }
    return true;
  });

  const totalAvailable = tables.filter((table) => getTableViewStatus(table) === 'AVAILABLE').length;
  const totalActive = tables.filter((table) => getTableViewStatus(table) === 'ACTIVE').length;
  const totalDisabled = tables.filter((table) => getTableViewStatus(table) === 'DISABLED').length;

  const qrInfoToken = qrViewTable?.qrCodeToken || '';
  const tableInfoUrl = user.tenantId && qrInfoToken ? `${API_BASE_URL}/orders/${user.tenantId}/table-info/${qrInfoToken}` : '';
  const qrOrderEndpoint = user.tenantId && qrInfoToken ? `${API_BASE_URL}/orders/${user.tenantId}/qr/${qrInfoToken}` : '';

  return (
    <View style={styles.screenContainer}>
      <ScreenBackdrop />
      <ScrollView
        style={styles.screenScroll}
        contentContainerStyle={styles.screenContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void fetchTableData(true)} />}
      >
        <View style={styles.screenStack}>
          <Text style={styles.sectionTitle}>Quan ly ban</Text>

          <View style={styles.metricGrid}>
            <View style={[styles.glassCard, styles.metricCard]}>
              <Text style={styles.metricLabel}>Con trong</Text>
              <Text style={styles.metricValue}>{totalAvailable}</Text>
            </View>
            <View style={[styles.glassCard, styles.metricCard]}>
              <Text style={styles.metricLabel}>Dang hoat dong</Text>
              <Text style={styles.metricValue}>{totalActive}</Text>
            </View>
            <View style={[styles.glassCard, styles.metricCard]}>
              <Text style={styles.metricLabel}>Tam ngung</Text>
              <Text style={styles.metricValue}>{totalDisabled}</Text>
            </View>
          </View>

          <View style={[styles.glassCard, styles.inventoryToolbar]}>
            <TextInput
              placeholder="Tim theo so ban/ten ban"
              value={search}
              onChangeText={setSearch}
              placeholderTextColor={COLORS.textMuted}
              style={styles.input}
            />

            <View style={styles.filterRow}>
              {(['ALL', 'AVAILABLE', 'ACTIVE', 'DISABLED'] as const).map((filter) => {
                const selected = statusFilter === filter;
                return (
                  <TouchableOpacity
                    key={filter}
                    activeOpacity={0.8}
                    style={[styles.filterChip, selected ? styles.filterChipActive : null]}
                    onPress={() => setStatusFilter(filter)}
                  >
                    <Text style={[styles.filterChipText, selected ? styles.filterChipTextActive : null]}>{getTableFilterLabel(filter)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity activeOpacity={0.8} style={[styles.buttonBase, styles.buttonPrimary]} onPress={openCreateForm}>
              <Text style={styles.buttonText}>Them ban</Text>
            </TouchableOpacity>
          </View>

          {formMode ? (
            <View style={[styles.glassCard, styles.formCard]}>
              <Text style={styles.sectionTitle}>{formMode === 'create' ? 'Them ban' : 'Sua ban'}</Text>
              {formError ? <Text style={styles.errorText}>{formError}</Text> : null}

              <TextInput
                placeholder="So ban (bat buoc)"
                value={formTableNumber}
                onChangeText={setFormTableNumber}
                keyboardType="number-pad"
                placeholderTextColor={COLORS.textMuted}
                style={styles.input}
              />
              <TextInput
                placeholder="Ten hien thi (tuy chon)"
                value={formDisplayName}
                onChangeText={setFormDisplayName}
                placeholderTextColor={COLORS.textMuted}
                style={styles.input}
              />
              <TextInput
                placeholder="Suc chua (tuy chon)"
                value={formCapacity}
                onChangeText={setFormCapacity}
                keyboardType="number-pad"
                placeholderTextColor={COLORS.textMuted}
                style={styles.input}
              />
              <TextInput
                placeholder="Khu vuc (tuy chon)"
                value={formLocation}
                onChangeText={setFormLocation}
                placeholderTextColor={COLORS.textMuted}
                style={styles.input}
              />

              <Text style={styles.helperText}>Trang thai ban</Text>
              <View style={styles.filterRow}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  style={[styles.filterChip, formStatus === 'AVAILABLE' ? styles.filterChipActive : null]}
                  onPress={() => setFormStatus('AVAILABLE')}
                >
                  <Text style={[styles.filterChipText, formStatus === 'AVAILABLE' ? styles.filterChipTextActive : null]}>Con trong</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.8}
                  style={[styles.filterChip, formStatus === 'ACTIVE' ? styles.filterChipActive : null]}
                  onPress={() => setFormStatus('ACTIVE')}
                >
                  <Text style={[styles.filterChipText, formStatus === 'ACTIVE' ? styles.filterChipTextActive : null]}>Dang hoat dong</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.8}
                  style={[styles.filterChip, formStatus === 'DISABLED' ? styles.filterChipActive : null]}
                  onPress={() => setFormStatus('DISABLED')}
                >
                  <Text style={[styles.filterChipText, formStatus === 'DISABLED' ? styles.filterChipTextActive : null]}>Tam ngung</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.rowSplit}>
                <TouchableOpacity activeOpacity={0.8} style={[styles.buttonBase, styles.buttonSecondary, styles.flex1]} onPress={resetForm}>
                  <Text style={styles.buttonText}>Huy</Text>
                </TouchableOpacity>
                <TouchableOpacity activeOpacity={0.8} style={[styles.buttonBase, styles.buttonPrimary, styles.flex1]} onPress={() => void saveTableForm()}>
                  {formSubmitting ? <ActivityIndicator color={COLORS.text} /> : <Text style={styles.buttonText}>Luu ban</Text>}
                </TouchableOpacity>
              </View>
            </View>
          ) : null}

          {qrViewTable ? (
            <View style={[styles.glassCard, styles.formCard]}>
              <Text style={styles.sectionTitle}>Xem QR - {qrViewTable.name}</Text>
              {qrViewTable.qrCodeToken ? (
                <>
                  <Text style={styles.staffMeta}>QR Token: {qrViewTable.qrCodeToken}</Text>
                  <Text style={styles.staffMeta}>Table Info URL: {tableInfoUrl || '-'}</Text>
                  <Text style={styles.staffMeta}>Order Endpoint: {qrOrderEndpoint || '-'}</Text>
                  <Text style={styles.helperText}>Chua co thu vien hien thi QR</Text>
                </>
              ) : (
                <Text style={styles.helperText}>Backend chua ho tro QR cho ban</Text>
              )}

              <TouchableOpacity activeOpacity={1} disabled style={[styles.buttonBase, styles.buttonSecondary]}>
                <Text style={styles.buttonText}>In QR</Text>
              </TouchableOpacity>
              <Text style={styles.helperText}>Chua tich hop may in QR</Text>

              <View style={styles.rowSplit}>
                <TouchableOpacity activeOpacity={0.8} style={[styles.buttonBase, styles.buttonSecondary, styles.flex1]} onPress={() => setQrViewTable(null)}>
                  <Text style={styles.buttonText}>Dong</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.8}
                  style={[styles.buttonBase, styles.buttonPrimary, styles.flex1]}
                  onPress={() => resetQrToken(qrViewTable)}
                >
                  <Text style={styles.buttonText}>Tao lai QR</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}

          {loadError ? <ErrorStateView message={loadError} onRetry={() => void fetchTableData()} /> : null}

          {!loadError && filteredTables.length === 0 ? (
            <EmptyStateView message="Chua co ban nao." />
          ) : (
            filteredTables.map((table) => {
              const viewStatus = getTableViewStatus(table);
              const statusStyle = viewStatus === 'DISABLED' ? styles.statusPending : viewStatus === 'ACTIVE' ? styles.statusLowStock : styles.statusProgress;
              const activeOrders = activeOrderCountByTable[table._id] || 0;
              const parsed = parseTableName(table.name);

              return (
                <View key={table._id} style={[styles.glassCard, styles.inventoryItemCard]}>
                  <View style={styles.staffHeader}>
                    <View style={styles.staffInfo}>
                      <Text style={styles.staffName}>{table.name}</Text>
                      <Text style={styles.staffMeta}>So ban: {parsed.tableNumber || 'Khong xac dinh'}</Text>
                      <Text style={styles.staffMeta}>Suc chua: {table.capacity || '-'}</Text>
                      <Text style={styles.staffMeta}>QR: {table.qrCodeToken ? 'San sang' : 'Backend chua ho tro QR cho ban'}</Text>
                      <Text style={styles.staffMeta}>Don dang mo: {activeOrders}</Text>
                    </View>
                    <View style={[styles.statusBadge, statusStyle]}>
                      <Text style={styles.statusText}>{getTableViewStatusLabel(viewStatus)}</Text>
                    </View>
                  </View>

                  <View style={styles.inventoryActionRow}>
                    <TouchableOpacity
                      activeOpacity={0.8}
                      style={[styles.buttonBase, styles.buttonSecondary, styles.flex1]}
                      disabled={!table.qrCodeToken}
                      onPress={() => setQrViewTable(table)}
                    >
                      <Text style={styles.buttonText}>Xem QR</Text>
                    </TouchableOpacity>
                    <TouchableOpacity activeOpacity={0.8} style={[styles.buttonBase, styles.buttonPrimary, styles.flex1]} onPress={() => openEditForm(table)}>
                      <Text style={styles.buttonText}>Sua ban</Text>
                    </TouchableOpacity>
                    <TouchableOpacity activeOpacity={0.8} style={[styles.buttonBase, styles.buttonAmber, styles.flex1]} onPress={() => confirmDeleteTable(table)}>
                      <Text style={styles.buttonText}>Xoa ban</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.inventoryActionRow}>
                    <TouchableOpacity activeOpacity={0.8} style={[styles.buttonBase, styles.buttonPrimary, styles.flex1]} onPress={() => resetQrToken(table)}>
                      <Text style={styles.buttonText}>Tao lai QR</Text>
                    </TouchableOpacity>
                    <TouchableOpacity activeOpacity={0.8} style={[styles.buttonBase, styles.buttonSecondary, styles.flex1]} onPress={() => toggleVisibility(table)}>
                      <Text style={styles.buttonText}>{table.isHidden ? 'Mo lai ban' : 'Tam ngung ban'}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function padDatePart(value: number) {
  return String(value).padStart(2, '0');
}

function getTodayDateInput() {
  const now = new Date();
  return `${now.getFullYear()}-${padDatePart(now.getMonth() + 1)}-${padDatePart(now.getDate())}`;
}

function getCurrentMonthInput() {
  return getTodayDateInput().slice(0, 7);
}

function getMonthFromDateInput(dateInput: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
    return dateInput.slice(0, 7);
  }
  return getCurrentMonthInput();
}

function formatDateTime(value?: string | null) {
  if (!value) return '--';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '--';
  return parsed.toLocaleString();
}

function toDateTimeInputValue(value?: string | null) {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return `${parsed.getFullYear()}-${padDatePart(parsed.getMonth() + 1)}-${padDatePart(parsed.getDate())} ${padDatePart(parsed.getHours())}:${padDatePart(parsed.getMinutes())}`;
}

function parseDateTimeInputToIso(value: string) {
  const normalized = value.trim();
  if (!normalized) return null;

  const replaced = normalized.includes('T') ? normalized : normalized.replace(' ', 'T');
  const parsed = new Date(replaced);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function getAttendanceUserId(row: DailyAttendanceRow) {
  if (typeof row.userId === 'string') return row.userId;
  if (row.userId && typeof row.userId._id === 'string') return row.userId._id;
  return '';
}

function getAttendancePrimaryStatus(row: DailyAttendanceRow): AttendancePrimaryStatus {
  if (row.status === 'ON_LEAVE') return 'ON_LEAVE';
  if (!row.checkInTime) return 'ABSENT';
  if (!row.checkOutTime) return 'MISSING_CHECKOUT';
  return 'COMPLETED';
}

function getAttendancePunctualStatus(row: DailyAttendanceRow): AttendancePunctualStatus {
  if (!row.checkInTime) return 'UNKNOWN';
  if (row.status === 'LATE') return 'LATE';
  if (row.status === 'ON_TIME') return 'ON_TIME';
  return 'UNKNOWN';
}

function getAttendanceStatusLabel(status: AttendanceFilterStatus) {
  if (status === 'ALL') return 'Tat ca';
  if (status === 'COMPLETED') return 'Da hoan thanh';
  if (status === 'MISSING_CHECKOUT') return 'Chua checkout';
  if (status === 'LATE') return 'Di tre';
  if (status === 'ON_TIME') return 'Dung gio';
  if (status === 'ABSENT') return 'Vang mat';
  if (status === 'ON_LEAVE') return 'Nghi phep';
  return status;
}

function AttendanceManagementScreen() {
  const { user } = useAuth();
  const [rows, setRows] = useState<DailyAttendanceRow[]>([]);
  const [screenLoading, setScreenLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');

  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState(getTodayDateInput());
  const [appliedDate, setAppliedDate] = useState(getTodayDateInput());
  const [roleFilter, setRoleFilter] = useState<StaffFilterRole>('ALL');
  const [statusFilter, setStatusFilter] = useState<AttendanceFilterStatus>('ALL');

  const [detailUser, setDetailUser] = useState<DailyAttendanceRow | null>(null);
  const [detailMonth, setDetailMonth] = useState(getCurrentMonthInput());
  const [detailData, setDetailData] = useState<MonthlyAttendanceData | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');

  const [editingRecordId, setEditingRecordId] = useState('');
  const [editCheckIn, setEditCheckIn] = useState('');
  const [editCheckOut, setEditCheckOut] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState('');

  const canEditAttendance = user?.role === 'ADMIN';

  const fetchAttendanceData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setScreenLoading(true);
      }
      setLoadError('');
      const dailyRows = await getDailyAttendance(appliedDate.trim() || undefined);
      setRows(dailyRows);
    } catch (err: any) {
      setLoadError(err.response?.data?.message || 'Khong the tai danh sach cham cong');
    } finally {
      setScreenLoading(false);
      setRefreshing(false);
    }
  }, [appliedDate]);

  useEffect(() => {
    void fetchAttendanceData();
  }, [fetchAttendanceData]);

  const closeDetail = useCallback(() => {
    setDetailUser(null);
    setDetailData(null);
    setDetailError('');
    setEditingRecordId('');
    setEditCheckIn('');
    setEditCheckOut('');
    setEditError('');
  }, []);

  const loadMonthlyDetail = useCallback(async (targetUser: DailyAttendanceRow, month: string) => {
    const targetUserId = getAttendanceUserId(targetUser);
    if (!targetUserId) {
      setDetailError('Khong xac dinh duoc userId nhan vien');
      return;
    }

    if (!/^\d{4}-\d{2}$/.test(month)) {
      setDetailError('Thang khong hop le. Dinh dang dung: YYYY-MM');
      return;
    }

    setDetailLoading(true);
    setDetailError('');
    try {
      const data = await getMonthlyAttendance(targetUserId, month);
      setDetailData(data);
    } catch (err: any) {
      setDetailError(err.response?.data?.message || 'Khong the tai chi tiet cham cong theo thang');
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const openDetail = useCallback((member: DailyAttendanceRow) => {
    const month = getMonthFromDateInput(appliedDate);
    setDetailUser(member);
    setDetailMonth(month);
    setDetailData(null);
    setEditingRecordId('');
    setEditCheckIn('');
    setEditCheckOut('');
    setEditError('');
    void loadMonthlyDetail(member, month);
  }, [appliedDate, loadMonthlyDetail]);

  const openEditAttendance = useCallback((record: NonNullable<MonthlyAttendanceData['records']>[number]) => {
    setEditingRecordId(record._id);
    setEditCheckIn(toDateTimeInputValue(record.checkInTime));
    setEditCheckOut(toDateTimeInputValue(record.checkOutTime));
    setEditError('');
  }, []);

  const submitEditAttendance = useCallback(async () => {
    if (!canEditAttendance) {
      setEditError('Backend chi cho phep ADMIN dieu chinh cham cong');
      return;
    }
    if (!editingRecordId || !detailUser) {
      setEditError('Khong tim thay ban ghi can dieu chinh');
      return;
    }

    const checkInInput = editCheckIn.trim();
    const checkOutInput = editCheckOut.trim();
    const checkInIso = checkInInput ? parseDateTimeInputToIso(checkInInput) : null;
    const checkOutIso = checkOutInput ? parseDateTimeInputToIso(checkOutInput) : null;

    if (checkInInput && !checkInIso) {
      setEditError('Gio check-in khong hop le. Dinh dang: YYYY-MM-DD HH:mm');
      return;
    }
    if (checkOutInput && !checkOutIso) {
      setEditError('Gio check-out khong hop le. Dinh dang: YYYY-MM-DD HH:mm');
      return;
    }
    if (!checkInIso && !checkOutIso) {
      setEditError('Can nhap it nhat mot truong check-in/check-out');
      return;
    }
    if (checkInIso && checkOutIso && new Date(checkOutIso).getTime() <= new Date(checkInIso).getTime()) {
      setEditError('Gio check-out phai sau gio check-in');
      return;
    }

    setEditSubmitting(true);
    setEditError('');
    try {
      await editAttendanceRecord(editingRecordId, {
        checkInTime: checkInIso || undefined,
        checkOutTime: checkOutIso || undefined,
      });
      Alert.alert('Thanh cong', 'Da cap nhat ban ghi cham cong');
      setEditingRecordId('');
      setEditCheckIn('');
      setEditCheckOut('');
      await loadMonthlyDetail(detailUser, detailMonth);
      void fetchAttendanceData(true);
    } catch (err: any) {
      setEditError(err.response?.data?.message || 'Khong the dieu chinh cham cong');
    } finally {
      setEditSubmitting(false);
    }
  }, [canEditAttendance, detailMonth, detailUser, editCheckIn, editCheckOut, editingRecordId, fetchAttendanceData, loadMonthlyDetail]);

  if (!user || !MANAGEMENT_ROLES.includes(user.role)) {
    return (
      <View style={styles.screenContainer}>
        <ScreenBackdrop />
        <RestrictedStateView message="Ban khong co quyen truy cap man hinh cham cong." />
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

  const keyword = search.trim().toLowerCase();
  const filteredRows = rows.filter((row) => {
    if (roleFilter !== 'ALL' && row.role !== roleFilter) return false;

    if (statusFilter !== 'ALL') {
      const primary = getAttendancePrimaryStatus(row);
      const punctual = getAttendancePunctualStatus(row);

      if ((statusFilter === 'COMPLETED' || statusFilter === 'MISSING_CHECKOUT' || statusFilter === 'ABSENT' || statusFilter === 'ON_LEAVE') && primary !== statusFilter) {
        return false;
      }
      if ((statusFilter === 'LATE' || statusFilter === 'ON_TIME') && punctual !== statusFilter) {
        return false;
      }
    }

    if (!keyword) return true;
    const searchable = `${row.name || ''} ${row.email || ''} ${row.role || ''}`.toLowerCase();
    return searchable.includes(keyword);
  });

  const completedCount = rows.filter((row) => getAttendancePrimaryStatus(row) === 'COMPLETED').length;
  const workingCount = rows.filter((row) => getAttendancePrimaryStatus(row) === 'MISSING_CHECKOUT').length;
  const lateCount = rows.filter((row) => getAttendancePunctualStatus(row) === 'LATE').length;
  const absentCount = rows.filter((row) => getAttendancePrimaryStatus(row) === 'ABSENT').length;

  return (
    <View style={styles.screenContainer}>
      <ScreenBackdrop />
      <ScrollView
        style={styles.screenScroll}
        contentContainerStyle={styles.screenContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void fetchAttendanceData(true)} />}
      >
        <View style={styles.screenStack}>
          <Text style={styles.sectionTitle}>Quan ly cham cong</Text>

          <View style={[styles.glassCard, styles.formCard]}>
            <Text style={styles.sectionTitle}>Bang chia ca</Text>
            <Text style={styles.helperText}>Backend chua ho tro chia ca</Text>
            <TouchableOpacity activeOpacity={1} disabled style={[styles.buttonBase, styles.buttonSecondary, styles.moduleCardDisabled]}>
              <Text style={styles.buttonText}>Tao ca lam</Text>
            </TouchableOpacity>
            <Text style={styles.helperText}>Dang cho backend bo sung module schedule/shift registration.</Text>
          </View>

          <View style={styles.metricGrid}>
            <View style={[styles.glassCard, styles.metricCard]}>
              <Text style={styles.metricLabel}>Dang lam</Text>
              <Text style={styles.metricValue}>{workingCount}</Text>
            </View>
            <View style={[styles.glassCard, styles.metricCard]}>
              <Text style={styles.metricLabel}>Da hoan thanh</Text>
              <Text style={styles.metricValue}>{completedCount}</Text>
            </View>
            <View style={[styles.glassCard, styles.metricCard]}>
              <Text style={styles.metricLabel}>Di tre</Text>
              <Text style={styles.metricValue}>{lateCount}</Text>
            </View>
            <View style={[styles.glassCard, styles.metricCard]}>
              <Text style={styles.metricLabel}>Vang mat</Text>
              <Text style={styles.metricValue}>{absentCount}</Text>
            </View>
          </View>

          <View style={[styles.glassCard, styles.inventoryToolbar]}>
            <TextInput
              placeholder="Ngay loc (YYYY-MM-DD)"
              value={dateFilter}
              onChangeText={setDateFilter}
              placeholderTextColor={COLORS.textMuted}
              style={styles.input}
            />
            <View style={styles.rowSplit}>
              <TouchableOpacity
                activeOpacity={0.8}
                style={[styles.buttonBase, styles.buttonSecondary, styles.flex1]}
                onPress={() => {
                  const today = getTodayDateInput();
                  setDateFilter(today);
                  setAppliedDate(today);
                  setDetailMonth(getMonthFromDateInput(today));
                }}
              >
                <Text style={styles.buttonText}>Hom nay</Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.8}
                style={[styles.buttonBase, styles.buttonPrimary, styles.flex1]}
                onPress={() => {
                  const normalizedDate = dateFilter.trim();
                  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedDate)) {
                    Alert.alert('Ngay khong hop le', 'Vui long nhap ngay theo dinh dang YYYY-MM-DD');
                    return;
                  }
                  setAppliedDate(normalizedDate);
                  setDetailMonth(getMonthFromDateInput(normalizedDate));
                }}
              >
                <Text style={styles.buttonText}>Tai du lieu</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              placeholder="Tim theo ten nhan vien"
              value={search}
              onChangeText={setSearch}
              placeholderTextColor={COLORS.textMuted}
              style={styles.input}
            />

            <Text style={styles.helperText}>Loc theo role</Text>
            <View style={styles.filterRow}>
              {(['ALL', 'ADMIN', 'MANAGER', 'USER', 'KITCHEN'] as const).map((role) => {
                const selected = roleFilter === role;
                return (
                  <TouchableOpacity
                    key={role}
                    activeOpacity={0.8}
                    style={[styles.filterChip, selected ? styles.filterChipActive : null]}
                    onPress={() => setRoleFilter(role)}
                  >
                    <Text style={[styles.filterChipText, selected ? styles.filterChipTextActive : null]}>
                      {role === 'ALL' ? 'Tat ca' : getStaffRoleLabel(role)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.helperText}>Loc theo trang thai</Text>
            <View style={styles.filterRow}>
              {ATTENDANCE_FILTER_OPTIONS.map((option) => {
                const selected = statusFilter === option;
                return (
                  <TouchableOpacity
                    key={option}
                    activeOpacity={0.8}
                    style={[styles.filterChip, selected ? styles.filterChipActive : null]}
                    onPress={() => setStatusFilter(option)}
                  >
                    <Text style={[styles.filterChipText, selected ? styles.filterChipTextActive : null]}>{getAttendanceStatusLabel(option)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {loadError ? <ErrorStateView message={loadError} onRetry={() => void fetchAttendanceData()} /> : null}

          {!loadError && filteredRows.length === 0 ? (
            <EmptyStateView message="Danh sach cham cong trong ngay dang trong." />
          ) : (
            filteredRows.map((row) => {
              const primary = getAttendancePrimaryStatus(row);
              const punctual = getAttendancePunctualStatus(row);
              const primaryStyle =
                primary === 'ABSENT' ? styles.statusPending : primary === 'MISSING_CHECKOUT' ? styles.statusLowStock : styles.statusProgress;
              const punctualStyle = punctual === 'LATE' ? styles.statusPending : styles.statusProgress;
              return (
                <View key={`${getAttendanceUserId(row)}-${row.name}`} style={[styles.glassCard, styles.staffCard]}>
                  <View style={styles.staffHeader}>
                    <View style={styles.staffInfo}>
                      <Text style={styles.staffName}>{row.name || 'Nhan vien'}</Text>
                      <Text style={styles.staffMeta}>Role: {getStaffRoleLabel(row.role)}</Text>
                      <Text style={styles.staffMeta}>Gio vao ca: Backend chua ho tro chia ca</Text>
                      <Text style={styles.staffMeta}>Gio ket thuc: Backend chua ho tro chia ca</Text>
                      <Text style={styles.staffMeta}>Gio check-in: {formatDateTime(row.checkInTime)}</Text>
                      <Text style={styles.staffMeta}>Gio check-out: {formatDateTime(row.checkOutTime)}</Text>
                      <Text style={styles.staffMeta}>Tong gio lam: {row.totalHours || 0}</Text>
                      <Text style={styles.staffMeta}>Phut di tre: {row.lateMinutes || 0}</Text>
                    </View>
                    <View style={styles.staffInfo}>
                      <View style={[styles.statusBadge, primaryStyle]}>
                        <Text style={styles.statusText}>{getAttendanceStatusLabel(primary)}</Text>
                      </View>
                      {punctual !== 'UNKNOWN' ? (
                        <View style={[styles.statusBadge, punctualStyle]}>
                          <Text style={styles.statusText}>{getAttendanceStatusLabel(punctual)}</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>

                  <TouchableOpacity activeOpacity={0.8} style={[styles.buttonBase, styles.buttonPrimary]} onPress={() => openDetail(row)}>
                    <Text style={styles.buttonText}>Danh sach cham cong</Text>
                  </TouchableOpacity>
                </View>
              );
            })
          )}

          {detailUser ? (
            <View style={[styles.glassCard, styles.formCard]}>
              <Text style={styles.sectionTitle}>Chi tiet cham cong: {detailUser.name}</Text>
              <View style={styles.rowSplit}>
                <TextInput
                  placeholder="Thang (YYYY-MM)"
                  value={detailMonth}
                  onChangeText={setDetailMonth}
                  placeholderTextColor={COLORS.textMuted}
                  style={[styles.input, styles.flex1]}
                />
                <TouchableOpacity
                  activeOpacity={0.8}
                  style={[styles.buttonBase, styles.buttonPrimary]}
                  onPress={() => void loadMonthlyDetail(detailUser, detailMonth)}
                >
                  <Text style={styles.buttonText}>Tai chi tiet</Text>
                </TouchableOpacity>
              </View>

              {detailError ? <ErrorStateView message={detailError} onRetry={() => void loadMonthlyDetail(detailUser, detailMonth)} /> : null}
              {detailLoading ? <LoadingView /> : null}

              {!detailLoading && !detailError && detailData ? (
                <>
                  <View style={styles.metricGrid}>
                    <View style={[styles.glassCard, styles.metricCard]}>
                      <Text style={styles.metricLabel}>Tong ngay lam</Text>
                      <Text style={styles.metricValue}>{detailData.totalWorkedDays || 0}</Text>
                    </View>
                    <View style={[styles.glassCard, styles.metricCard]}>
                      <Text style={styles.metricLabel}>Tong gio lam</Text>
                      <Text style={styles.metricValue}>{detailData.totalWorkedHours || 0}</Text>
                    </View>
                    <View style={[styles.glassCard, styles.metricCard]}>
                      <Text style={styles.metricLabel}>Tong phut di tre</Text>
                      <Text style={styles.metricValue}>{detailData.totalLateMinutes || 0}</Text>
                    </View>
                  </View>

                  {!Array.isArray(detailData.records) || detailData.records.length === 0 ? (
                    <EmptyStateView message="Khong co ban ghi cham cong trong thang nay." />
                  ) : (
                    detailData.records.map((record) => {
                      const isEditing = editingRecordId === record._id;
                      const statusText =
                        record.status === 'ON_LEAVE'
                          ? 'Nghi phep'
                          : !record.checkInTime
                            ? 'Vang mat'
                            : record.checkOutTime
                              ? 'Da hoan thanh'
                              : 'Chua checkout';

                      return (
                        <View key={record._id} style={[styles.glassCard, styles.staffCard]}>
                          <Text style={styles.staffName}>{new Date(record.date).toLocaleDateString()}</Text>
                          <Text style={styles.staffMeta}>Gio check-in: {formatDateTime(record.checkInTime)}</Text>
                          <Text style={styles.staffMeta}>Gio check-out: {formatDateTime(record.checkOutTime)}</Text>
                          <Text style={styles.staffMeta}>Tong gio lam: {record.totalHours || 0}</Text>
                          <Text style={styles.staffMeta}>Trang thai: {statusText}</Text>
                          <Text style={styles.staffMeta}>Di tre: {record.lateMinutes || 0} phut</Text>

                          {canEditAttendance ? (
                            <TouchableOpacity
                              activeOpacity={0.8}
                              style={[styles.buttonBase, styles.buttonSecondary]}
                              onPress={() => openEditAttendance(record)}
                            >
                              <Text style={styles.buttonText}>Dieu chinh cham cong</Text>
                            </TouchableOpacity>
                          ) : (
                            <TouchableOpacity activeOpacity={1} disabled style={[styles.buttonBase, styles.buttonSecondary, styles.moduleCardDisabled]}>
                              <Text style={styles.buttonText}>Can quyen ADMIN de dieu chinh cham cong</Text>
                            </TouchableOpacity>
                          )}

                          {isEditing ? (
                            <View style={styles.formStack}>
                              {editError ? <Text style={styles.errorText}>{editError}</Text> : null}
                              <TextInput
                                placeholder="Gio check-in (YYYY-MM-DD HH:mm)"
                                value={editCheckIn}
                                onChangeText={setEditCheckIn}
                                placeholderTextColor={COLORS.textMuted}
                                style={styles.input}
                              />
                              <TextInput
                                placeholder="Gio check-out (YYYY-MM-DD HH:mm)"
                                value={editCheckOut}
                                onChangeText={setEditCheckOut}
                                placeholderTextColor={COLORS.textMuted}
                                style={styles.input}
                              />
                              <View style={styles.rowSplit}>
                                <TouchableOpacity
                                  activeOpacity={0.8}
                                  style={[styles.buttonBase, styles.buttonSecondary, styles.flex1]}
                                  onPress={() => {
                                    setEditingRecordId('');
                                    setEditCheckIn('');
                                    setEditCheckOut('');
                                    setEditError('');
                                  }}
                                >
                                  <Text style={styles.buttonText}>Huy</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                  activeOpacity={0.8}
                                  style={[styles.buttonBase, styles.buttonPrimary, styles.flex1]}
                                  onPress={() => void submitEditAttendance()}
                                >
                                  {editSubmitting ? <ActivityIndicator color={COLORS.text} /> : <Text style={styles.buttonText}>Luu dieu chinh</Text>}
                                </TouchableOpacity>
                              </View>
                            </View>
                          ) : null}
                        </View>
                      );
                    })
                  )}
                </>
              ) : null}

              <TouchableOpacity activeOpacity={0.8} style={[styles.buttonBase, styles.buttonSecondary]} onPress={closeDetail}>
                <Text style={styles.buttonText}>Dong chi tiet</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

function normalizeToStaffRole(role: string | undefined | null): StaffRole {
  if (role === 'ADMIN' || role === 'MANAGER' || role === 'USER' || role === 'KITCHEN') {
    return role;
  }
  return 'USER';
}

function getPayrollRecordUserId(record: PayrollRecord) {
  if (typeof record.userId === 'string') return record.userId;
  if (record.userId && typeof record.userId._id === 'string') return record.userId._id;
  return '';
}

function getPayrollFilterStatusLabel(status: PayrollFilterStatus) {
  if (status === 'ALL') return 'Tat ca';
  if (status === 'ACTIVE') return 'Dang hoat dong';
  if (status === 'LOCKED') return 'Da khoa';
  if (status === 'DELETED') return 'Vo hieu hoa';
  return 'Khong ro';
}

function getPayrollRowStatusLabel(status: PayrollViewRow['status']) {
  if (status === 'UNKNOWN') return 'Khong ro';
  if (status === 'LOCKED') return 'Da khoa';
  if (status === 'DELETED') return 'Vo hieu hoa';
  return 'Dang hoat dong';
}

function formatCurrencyVnd(value: number) {
  return `${Math.round(value).toLocaleString()}d`;
}

function getAttendanceRecordHours(record: NonNullable<MonthlyAttendanceData['records']>[number]) {
  if (typeof record.totalHours === 'number' && Number.isFinite(record.totalHours)) {
    return record.totalHours;
  }
  if (record.checkInTime && record.checkOutTime) {
    const start = new Date(record.checkInTime).getTime();
    const end = new Date(record.checkOutTime).getTime();
    if (!Number.isNaN(start) && !Number.isNaN(end) && end > start) {
      return Number(((end - start) / (1000 * 60 * 60)).toFixed(2));
    }
  }
  return 0;
}

function PayrollManagementScreen() {
  const { user } = useAuth();
  const [rows, setRows] = useState<PayrollViewRow[]>([]);
  const [screenLoading, setScreenLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [payrollApiNotice, setPayrollApiNotice] = useState('');

  const [monthInput, setMonthInput] = useState(getCurrentMonthInput());
  const [appliedMonth, setAppliedMonth] = useState(getCurrentMonthInput());
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<StaffFilterRole>('ALL');
  const [statusFilter, setStatusFilter] = useState<PayrollFilterStatus>('ALL');
  const [calculating, setCalculating] = useState(false);

  const [detailUserId, setDetailUserId] = useState('');
  const [detailPayroll, setDetailPayroll] = useState<PayrollRecord | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');

  const canViewPayroll = Boolean(user && MANAGEMENT_ROLES.includes(user.role));
  const canCalculatePayroll = user?.role === 'ADMIN';

  const fetchPayrollData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setScreenLoading(true);
      }
      setLoadError('');
      setPayrollApiNotice('');

      const staffRows = await getStaffUsers();
      const staffUsers = staffRows.filter((member) => member.role !== 'SYSTEM_OWNER');
      const staffMap = new Map(staffUsers.map((member) => [member._id, member] as const));

      let payrollRows: PayrollRecord[] = [];
      try {
        payrollRows = await getPayrollRecords(appliedMonth);
      } catch (err: any) {
        const statusCode = err?.response?.status;
        if (statusCode === 404) {
          setPayrollApiNotice('Backend chua co payroll API rieng');
        } else {
          setPayrollApiNotice('Khong the tai payroll API. Dang hien thi luong tam tinh tu cham cong.');
        }
      }

      const payrollMap = new Map<string, PayrollRecord>();
      payrollRows.forEach((record) => {
        const recordUserId = getPayrollRecordUserId(record);
        if (recordUserId) {
          payrollMap.set(recordUserId, record);
        }
      });

      const userIds = Array.from(
        new Set([
          ...staffUsers.map((member) => member._id),
          ...payrollRows.map((record) => getPayrollRecordUserId(record)).filter((recordUserId) => !!recordUserId),
        ]),
      );

      const monthlyEntries = await Promise.all(
        userIds.map(async (targetUserId) => {
          try {
            const monthly = await getMonthlyAttendance(targetUserId, appliedMonth);
            return [targetUserId, monthly] as const;
          } catch {
            return [targetUserId, null] as const;
          }
        }),
      );
      const monthlyMap = new Map(monthlyEntries);

      const mappedRows: PayrollViewRow[] = userIds.map((targetUserId) => {
        const staffMember = staffMap.get(targetUserId);
        const payrollRecord = payrollMap.get(targetUserId) || null;
        const monthlyAttendance = monthlyMap.get(targetUserId) || null;
        const payrollUserRef = payrollRecord && typeof payrollRecord.userId !== 'string' ? payrollRecord.userId : null;

        const role = normalizeToStaffRole(staffMember?.role || payrollUserRef?.role);
        const status: PayrollViewRow['status'] = staffMember?.status || 'UNKNOWN';
        const account = staffMember?.email || staffMember?.phone || payrollUserRef?.email || '';
        const name = staffMember?.name || payrollUserRef?.name || 'Nhan vien';
        const hourlyWage = typeof staffMember?.salaryConfig?.baseHourly === 'number' ? staffMember.salaryConfig.baseHourly : null;

        const workedHoursFromRecords = monthlyAttendance?.records?.reduce((sum, record) => sum + getAttendanceRecordHours(record), 0) || 0;
        const workedHours =
          payrollRecord && Number.isFinite(payrollRecord.workedHours)
            ? payrollRecord.workedHours
            : monthlyAttendance && Number.isFinite(monthlyAttendance.totalWorkedHours)
              ? monthlyAttendance.totalWorkedHours
              : Number(workedHoursFromRecords.toFixed(2));

        const penaltyRecords = (monthlyAttendance?.records || [])
          .filter((record) => (record.lateMinutes || 0) >= PAYROLL_LATE_MINUTES_THRESHOLD)
          .map((record) => ({
            date: record.date,
            checkInTime: record.checkInTime,
            lateMinutes: record.lateMinutes || 0,
            penaltyAmount: PAYROLL_LATE_PENALTY_AMOUNT,
          }));

        const latePenaltyTotal = penaltyRecords.reduce((sum, record) => sum + record.penaltyAmount, 0);
        const grossSalary = hourlyWage === null ? null : Math.round(workedHours * hourlyWage);
        const finalSalaryPreview = grossSalary === null ? null : Math.max(0, grossSalary - latePenaltyTotal);

        return {
          userId: targetUserId,
          name,
          account,
          role,
          status,
          hourlyWage,
          workedHours,
          grossSalary,
          latePenaltyTotal,
          finalSalaryPreview,
          monthlyAttendance,
          penaltyRecords,
          payrollRecord,
        };
      });

      mappedRows.sort((a, b) => a.name.localeCompare(b.name, 'vi'));
      setRows(mappedRows);
    } catch (err: any) {
      setLoadError(err.response?.data?.message || 'Khong the tai bang luong');
      setRows([]);
    } finally {
      setScreenLoading(false);
      setRefreshing(false);
    }
  }, [appliedMonth]);

  useEffect(() => {
    setDetailUserId('');
    setDetailPayroll(null);
    setDetailError('');
  }, [appliedMonth]);

  useEffect(() => {
    void fetchPayrollData();
  }, [fetchPayrollData]);

  const applyMonth = useCallback(() => {
    const normalizedMonth = monthInput.trim();
    if (!/^\d{4}-\d{2}$/.test(normalizedMonth)) {
      Alert.alert('Thang khong hop le', 'Vui long nhap thang theo dinh dang YYYY-MM');
      return;
    }
    setAppliedMonth(normalizedMonth);
  }, [monthInput]);

  const handleCalculatePayroll = useCallback(() => {
    if (!canCalculatePayroll) return;

    Alert.alert('Tinh luong nhan vien', `Ban muon tinh luong thang ${appliedMonth}?`, [
      { text: 'Huy', style: 'cancel' },
      {
        text: 'Tinh luong',
        onPress: async () => {
          try {
            setCalculating(true);
            const result = await calculatePayroll(appliedMonth);
            Alert.alert('Thanh cong', result?.message || `Da gui tinh luong thang ${appliedMonth}`);
            void fetchPayrollData(true);
          } catch (err: any) {
            Alert.alert('Loi', err.response?.data?.message || 'Khong the tinh luong');
          } finally {
            setCalculating(false);
          }
        },
      },
    ]);
  }, [appliedMonth, canCalculatePayroll, fetchPayrollData]);

  const openPayrollDetail = useCallback(async (row: PayrollViewRow) => {
    setDetailUserId(row.userId);
    setDetailPayroll(row.payrollRecord);
    setDetailError('');
    setDetailLoading(true);

    try {
      const detail = await getPayrollRecordDetail(row.userId, appliedMonth);
      if (detail) {
        setDetailPayroll(detail);
      }
    } catch (err: any) {
      const statusCode = err?.response?.status;
      if (statusCode === 404) {
        setDetailError('Backend chua co payroll API rieng');
      } else {
        setDetailError(err.response?.data?.message || 'Khong the tai chi tiet luong');
      }
    } finally {
      setDetailLoading(false);
    }
  }, [appliedMonth]);

  if (!canViewPayroll) {
    return (
      <View style={styles.screenContainer}>
        <ScreenBackdrop />
        <RestrictedStateView message="Ban khong co quyen truy cap man hinh bang luong." />
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

  const keyword = search.trim().toLowerCase();
  const filteredRows = rows.filter((row) => {
    if (roleFilter !== 'ALL' && row.role !== roleFilter) return false;
    if (statusFilter !== 'ALL' && row.status !== statusFilter) return false;
    if (!keyword) return true;
    const searchable = `${row.name} ${row.account} ${row.role}`.toLowerCase();
    return searchable.includes(keyword);
  });

  const totalGrossSalary = filteredRows.reduce((sum, row) => sum + (row.grossSalary || 0), 0);
  const totalPenalty = filteredRows.reduce((sum, row) => sum + row.latePenaltyTotal, 0);
  const totalFinalPreview = filteredRows.reduce((sum, row) => sum + (row.finalSalaryPreview || 0), 0);

  const selectedRow = detailUserId ? rows.find((row) => row.userId === detailUserId) || null : null;
  const detailAttendanceRecords = selectedRow?.monthlyAttendance?.records || [];

  return (
    <View style={styles.screenContainer}>
      <ScreenBackdrop />
      <ScrollView
        style={styles.screenScroll}
        contentContainerStyle={styles.screenContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void fetchPayrollData(true)} />}
      >
        <View style={styles.screenStack}>
          <Text style={styles.sectionTitle}>Bang luong</Text>

          <View style={[styles.glassCard, styles.inventoryToolbar]}>
            <TextInput
              placeholder="Thang luong (YYYY-MM)"
              value={monthInput}
              onChangeText={setMonthInput}
              placeholderTextColor={COLORS.textMuted}
              style={styles.input}
            />

            <View style={styles.rowSplit}>
              <TouchableOpacity activeOpacity={0.8} style={[styles.buttonBase, styles.buttonSecondary, styles.flex1]} onPress={applyMonth}>
                <Text style={styles.buttonText}>Luong thang</Text>
              </TouchableOpacity>

              {canCalculatePayroll ? (
                <TouchableOpacity activeOpacity={0.8} style={[styles.buttonBase, styles.buttonPrimary, styles.flex1]} onPress={handleCalculatePayroll}>
                  {calculating ? <ActivityIndicator color={COLORS.text} /> : <Text style={styles.buttonText}>Tinh luong nhan vien</Text>}
                </TouchableOpacity>
              ) : (
                <TouchableOpacity activeOpacity={1} disabled style={[styles.buttonBase, styles.buttonSecondary, styles.flex1, styles.moduleCardDisabled]}>
                  <Text style={styles.buttonText}>Chi xem (Manager)</Text>
                </TouchableOpacity>
              )}
            </View>

            <TextInput
              placeholder="Tim theo ten nhan vien / tai khoan"
              value={search}
              onChangeText={setSearch}
              placeholderTextColor={COLORS.textMuted}
              style={styles.input}
            />

            <Text style={styles.helperText}>Loc theo role</Text>
            <View style={styles.filterRow}>
              {(['ALL', 'ADMIN', 'MANAGER', 'USER', 'KITCHEN'] as const).map((role) => {
                const selected = roleFilter === role;
                return (
                  <TouchableOpacity
                    key={role}
                    activeOpacity={0.8}
                    style={[styles.filterChip, selected ? styles.filterChipActive : null]}
                    onPress={() => setRoleFilter(role)}
                  >
                    <Text style={[styles.filterChipText, selected ? styles.filterChipTextActive : null]}>
                      {role === 'ALL' ? 'Tat ca' : getStaffRoleLabel(role)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.helperText}>Loc theo trang thai</Text>
            <View style={styles.filterRow}>
              {PAYROLL_STATUS_FILTER_OPTIONS.map((status) => {
                const selected = statusFilter === status;
                return (
                  <TouchableOpacity
                    key={status}
                    activeOpacity={0.8}
                    style={[styles.filterChip, selected ? styles.filterChipActive : null]}
                    onPress={() => setStatusFilter(status)}
                  >
                    <Text style={[styles.filterChipText, selected ? styles.filterChipTextActive : null]}>{getPayrollFilterStatusLabel(status)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {payrollApiNotice ? (
            <View style={[styles.glassCard, styles.disabledBlock]}>
              <Text style={styles.helperText}>{payrollApiNotice}</Text>
            </View>
          ) : (
            <View style={[styles.glassCard, styles.disabledBlock]}>
              <Text style={styles.helperText}>Luong tam tinh duoc tinh tu cham cong theo quy tac di tre tu 5 phut tro len tru 20,000 VND/lan.</Text>
            </View>
          )}

          <View style={styles.metricGrid}>
            <View style={[styles.glassCard, styles.metricCard]}>
              <Text style={styles.metricLabel}>Luong tam tinh</Text>
              <Text style={styles.metricValue}>{formatCurrencyVnd(totalGrossSalary)}</Text>
            </View>
            <View style={[styles.glassCard, styles.metricCard]}>
              <Text style={styles.metricLabel}>Tong phat di tre</Text>
              <Text style={styles.metricValue}>{formatCurrencyVnd(totalPenalty)}</Text>
            </View>
            <View style={[styles.glassCard, styles.metricCard]}>
              <Text style={styles.metricLabel}>Luong thuc nhan</Text>
              <Text style={styles.metricValue}>{formatCurrencyVnd(totalFinalPreview)}</Text>
            </View>
          </View>

          {loadError ? <ErrorStateView message={loadError} onRetry={() => void fetchPayrollData()} /> : null}

          {!loadError && filteredRows.length === 0 ? (
            <EmptyStateView message="Khong co du lieu bang luong trong thang nay." />
          ) : (
            filteredRows.map((row) => {
              const statusStyle = row.status === 'LOCKED' ? styles.statusPending : row.status === 'DELETED' ? styles.statusLowStock : styles.statusProgress;
              return (
                <View key={row.userId} style={[styles.glassCard, styles.staffCard]}>
                  <View style={styles.staffHeader}>
                    <View style={styles.staffInfo}>
                      <Text style={styles.staffName}>{row.name}</Text>
                      <Text style={styles.staffMeta}>Role: {getStaffRoleLabel(row.role)}</Text>
                      <Text style={styles.staffMeta}>Tai khoan: {row.account || '-'}</Text>
                      <Text style={styles.staffMeta}>
                        Luong theo gio:{' '}
                        {row.hourlyWage === null ? 'Chua cau hinh luong' : formatCurrencyVnd(row.hourlyWage)}
                      </Text>
                      <Text style={styles.staffMeta}>Tong gio lam: {Number(row.workedHours.toFixed(2))}</Text>
                      <Text style={styles.staffMeta}>
                        Luong tam tinh: {row.grossSalary === null ? 'Chua cau hinh luong' : formatCurrencyVnd(row.grossSalary)}
                      </Text>
                      <Text style={styles.staffMeta}>Tong phat di tre: {formatCurrencyVnd(row.latePenaltyTotal)}</Text>
                      <Text style={styles.staffMeta}>
                        Luong thuc nhan: {row.finalSalaryPreview === null ? 'Chua cau hinh luong' : formatCurrencyVnd(row.finalSalaryPreview)}
                      </Text>
                      {row.payrollRecord ? (
                        <Text style={styles.staffMeta}>
                          Backend salary: {formatCurrencyVnd(row.payrollRecord.finalSalary || 0)} ({row.payrollRecord.status || 'N/A'})
                        </Text>
                      ) : (
                        <Text style={styles.staffMeta}>Backend chua co payroll API rieng</Text>
                      )}
                    </View>
                    <View style={[styles.statusBadge, statusStyle]}>
                      <Text style={styles.statusText}>{getPayrollRowStatusLabel(row.status)}</Text>
                    </View>
                  </View>

                  <TouchableOpacity activeOpacity={0.8} style={[styles.buttonBase, styles.buttonPrimary]} onPress={() => void openPayrollDetail(row)}>
                    <Text style={styles.buttonText}>Chi tiet luong</Text>
                  </TouchableOpacity>
                </View>
              );
            })
          )}

          {selectedRow ? (
            <View style={[styles.glassCard, styles.formCard]}>
              <Text style={styles.sectionTitle}>Chi tiet luong - {selectedRow.name}</Text>
              <Text style={styles.staffMeta}>Luong thang: {appliedMonth}</Text>
              <Text style={styles.staffMeta}>Role: {getStaffRoleLabel(selectedRow.role)}</Text>
              <Text style={styles.staffMeta}>
                Luong theo gio: {selectedRow.hourlyWage === null ? 'Chua cau hinh luong' : formatCurrencyVnd(selectedRow.hourlyWage)}
              </Text>
              <Text style={styles.staffMeta}>Tong gio lam: {Number(selectedRow.workedHours.toFixed(2))}</Text>
              <Text style={styles.staffMeta}>
                Luong tam tinh: {selectedRow.grossSalary === null ? 'Chua cau hinh luong' : formatCurrencyVnd(selectedRow.grossSalary)}
              </Text>
              <Text style={styles.staffMeta}>Tong phat di tre: {formatCurrencyVnd(selectedRow.latePenaltyTotal)}</Text>
              <Text style={styles.staffMeta}>
                Luong thuc nhan: {selectedRow.finalSalaryPreview === null ? 'Chua cau hinh luong' : formatCurrencyVnd(selectedRow.finalSalaryPreview)}
              </Text>

              {detailLoading ? <LoadingView /> : null}
              {detailError ? <Text style={styles.otpNotice}>{detailError}</Text> : null}

              {detailPayroll ? (
                <View style={[styles.glassCard, styles.disabledBlock]}>
                  <Text style={styles.sectionTitle}>Du lieu payroll backend</Text>
                  <Text style={styles.staffMeta}>Trang thai: {detailPayroll.status || '-'}</Text>
                  <Text style={styles.staffMeta}>Worked hours: {detailPayroll.workedHours || 0}</Text>
                  <Text style={styles.staffMeta}>Tong khau tru backend: {formatCurrencyVnd(detailPayroll.totalDeductions || 0)}</Text>
                  <Text style={styles.staffMeta}>Luong backend: {formatCurrencyVnd(detailPayroll.finalSalary || 0)}</Text>
                </View>
              ) : null}

              <Text style={styles.sectionTitle}>Khoan tru di tre</Text>
              {selectedRow.penaltyRecords.length === 0 ? (
                <EmptyStateView message="Khong co khoan tru di tre trong thang nay." />
              ) : (
                selectedRow.penaltyRecords.map((penalty, idx) => (
                  <View key={`${selectedRow.userId}-penalty-${idx}`} style={[styles.glassCard, styles.staffCard]}>
                    <Text style={styles.staffMeta}>Ngay: {new Date(penalty.date).toLocaleDateString()}</Text>
                    <Text style={styles.staffMeta}>Gio vao ca: Backend chua ho tro</Text>
                    <Text style={styles.staffMeta}>Gio check-in: {formatDateTime(penalty.checkInTime)}</Text>
                    <Text style={styles.staffMeta}>Di tre: {penalty.lateMinutes} phut</Text>
                    <Text style={styles.staffMeta}>Khoan tru di tre: {formatCurrencyVnd(penalty.penaltyAmount)}</Text>
                    <Text style={styles.staffMeta}>Trang thai: Tinh tu du lieu attendance</Text>
                  </View>
                ))
              )}

              <TouchableOpacity activeOpacity={1} disabled style={[styles.buttonBase, styles.buttonSecondary, styles.moduleCardDisabled]}>
                <Text style={styles.buttonText}>Xoa khoan tru di tre</Text>
              </TouchableOpacity>
              <Text style={styles.helperText}>Backend chua ho tro xoa khoan tru luong</Text>

              <Text style={styles.sectionTitle}>Ban ghi cham cong dung de tinh luong</Text>
              {detailAttendanceRecords.length === 0 ? (
                <EmptyStateView message="Khong co ban ghi cham cong cho thang nay." />
              ) : (
                detailAttendanceRecords.map((record) => {
                  const lateMinutes = record.lateMinutes || 0;
                  const penaltyApplied = lateMinutes >= PAYROLL_LATE_MINUTES_THRESHOLD;
                  const recordHours = getAttendanceRecordHours(record);
                  return (
                    <View key={record._id} style={[styles.glassCard, styles.staffCard]}>
                      <Text style={styles.staffMeta}>Ngay: {new Date(record.date).toLocaleDateString()}</Text>
                      <Text style={styles.staffMeta}>Gio check-in: {formatDateTime(record.checkInTime)}</Text>
                      <Text style={styles.staffMeta}>Gio check-out: {formatDateTime(record.checkOutTime)}</Text>
                      <Text style={styles.staffMeta}>Tong gio lam: {recordHours}</Text>
                      <Text style={styles.staffMeta}>Di tre: {lateMinutes} phut</Text>
                      <Text style={styles.staffMeta}>
                        Khoan tru ap dung: {penaltyApplied ? formatCurrencyVnd(PAYROLL_LATE_PENALTY_AMOUNT) : 'Khong'}
                      </Text>
                    </View>
                  );
                })
              )}

              <TouchableOpacity
                activeOpacity={0.8}
                style={[styles.buttonBase, styles.buttonSecondary]}
                onPress={() => {
                  setDetailUserId('');
                  setDetailPayroll(null);
                  setDetailError('');
                }}
              >
                <Text style={styles.buttonText}>Dong chi tiet</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

function getStaffStatusLabel(status: StaffStatus) {
  if (status === 'LOCKED') return 'Da khoa';
  if (status === 'DELETED') return 'Vo hieu hoa';
  return 'Dang hoat dong';
}

function getStaffRoleLabel(role: StaffUser['role']) {
  if (role === 'ADMIN') return 'Chu quan/Admin';
  if (role === 'MANAGER') return 'Quan ly';
  if (role === 'KITCHEN') return 'Nhan vien bep';
  if (role === 'USER') return 'Nhan vien';
  return 'System Owner';
}

function getStaffLoginIdentifier(member: StaffUser) {
  return member.email || member.phone || '';
}

function normalizeEditableRole(role: StaffUser['role']): StaffEditableRole {
  if (STAFF_EDIT_ROLE_OPTIONS.includes(role as StaffEditableRole)) {
    return role as StaffEditableRole;
  }
  return 'USER';
}

function parseStaffIdentity(rawValue: string): { email?: string; phone?: string; error?: string } {
  const value = rawValue.trim();
  if (!value) {
    return { error: 'Ten tai khoan la bat buoc' };
  }

  if (value.includes('@')) {
    const normalizedEmail = value.toLowerCase();
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(normalizedEmail)) {
      return { error: 'Email khong hop le' };
    }
    return { email: normalizedEmail };
  }

  const normalizedPhone = value.replace(/\s+/g, '');
  if (!/^\+?\d{6,15}$/.test(normalizedPhone)) {
    return { error: 'So dien thoai khong hop le' };
  }
  return { phone: normalizedPhone };
}

function StaffManagementScreen() {
  const { user } = useAuth();
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [screenLoading, setScreenLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<StaffFilterRole>('ALL');
  const [statusFilter, setStatusFilter] = useState<StaffFilterStatus>('ALL');

  const [formMode, setFormMode] = useState<'create' | 'edit' | null>(null);
  const [editingMember, setEditingMember] = useState<StaffUser | null>(null);
  const [formName, setFormName] = useState('');
  const [formUsername, setFormUsername] = useState('');
  const [formRole, setFormRole] = useState<StaffEditableRole>('USER');
  const [formHourlyWage, setFormHourlyWage] = useState('');
  const [formError, setFormError] = useState('');
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [creationNote, setCreationNote] = useState('');

  const canManage = user?.role === 'ADMIN';

  const fetchStaff = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setScreenLoading(true);
      }
      setLoadError('');
      const rows = await getStaffUsers();
      setStaff(rows);
    } catch (err: any) {
      setLoadError(err.response?.data?.message || 'Khong the tai du lieu nhan su');
    } finally {
      setScreenLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchStaff();
  }, [fetchStaff]);

  const resetForm = useCallback(() => {
    setFormMode(null);
    setEditingMember(null);
    setFormName('');
    setFormUsername('');
    setFormRole('USER');
    setFormHourlyWage('');
    setFormError('');
  }, []);

  const openCreateForm = useCallback(() => {
    if (!canManage) {
      Alert.alert('Khong du quyen', 'Can quyen ADMIN de tao nhan vien.');
      return;
    }
    setCreationNote('');
    setFormMode('create');
    setEditingMember(null);
    setFormName('');
    setFormUsername('');
    setFormRole('USER');
    setFormHourlyWage('');
    setFormError('');
  }, [canManage]);

  const openEditForm = useCallback((member: StaffUser) => {
    if (!canManage) {
      Alert.alert('Khong du quyen', 'Can quyen ADMIN de sua nhan vien.');
      return;
    }
    if (member.role === 'SYSTEM_OWNER') {
      Alert.alert('Khong ho tro', 'Khong the sua tai khoan SYSTEM_OWNER.');
      return;
    }

    setCreationNote('');
    setFormMode('edit');
    setEditingMember(member);
    setFormName(member.name || '');
    setFormUsername(getStaffLoginIdentifier(member));
    setFormRole(normalizeEditableRole(member.role));
    setFormHourlyWage(
      member.salaryConfig?.baseHourly === undefined || member.salaryConfig?.baseHourly === null
        ? ''
        : String(member.salaryConfig.baseHourly),
    );
    setFormError('');
  }, [canManage]);

  const saveStaffForm = useCallback(async () => {
    if (!canManage) {
      setFormError('Can quyen ADMIN de thay doi nhan su');
      return;
    }

    const name = formName.trim();
    if (!name) {
      setFormError('Ten nhan vien la bat buoc');
      return;
    }

    const identity = parseStaffIdentity(formUsername);
    if (identity.error) {
      setFormError(identity.error);
      return;
    }

    let baseHourly: number | undefined;
    if (formHourlyWage.trim()) {
      const parsedHourlyWage = Number(formHourlyWage);
      if (!Number.isFinite(parsedHourlyWage) || parsedHourlyWage < 0) {
        setFormError('Luong theo gio phai la so khong am');
        return;
      }
      baseHourly = parsedHourlyWage;
    }

    setFormSubmitting(true);
    setFormError('');
    try {
      if (formMode === 'create') {
        await createStaffUser({
          name,
          role: formRole,
          password: '1',
          email: identity.email,
          phone: identity.phone,
          baseHourly,
        });
        setCreationNote('Mat khau mac dinh la 1. Nhan vien nen doi mat khau sau khi dang nhap.');
      } else if (formMode === 'edit' && editingMember) {
        if (editingMember._id === user?.userId && formRole !== editingMember.role) {
          setFormError('Khong the doi role cua tai khoan dang dang nhap');
          return;
        }

        await updateStaffUser(editingMember._id, {
          name,
          email: identity.email || '',
          phone: identity.phone || '',
          baseHourly,
        });

        if (formRole !== editingMember.role) {
          await changeStaffRole(editingMember._id, formRole);
        }
      }

      resetForm();
      void fetchStaff(true);
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Khong the luu nhan vien');
    } finally {
      setFormSubmitting(false);
    }
  }, [canManage, editingMember, fetchStaff, formHourlyWage, formMode, formName, formRole, formUsername, resetForm, user?.userId]);

  const handleToggleLock = useCallback((member: StaffUser) => {
    if (!canManage) {
      Alert.alert('Khong du quyen', 'Can quyen ADMIN de khoa/mo khoa tai khoan.');
      return;
    }
    if (!user) return;
    if (member._id === user.userId) {
      Alert.alert('Khong hop le', 'Khong the khoa tai khoan dang dang nhap.');
      return;
    }
    if (member.role === 'SYSTEM_OWNER') {
      Alert.alert('Khong hop le', 'Khong the khoa/mo khoa SYSTEM_OWNER.');
      return;
    }
    if (member.status !== 'LOCKED' && member.role === 'ADMIN') {
      Alert.alert('Khong hop le', 'Khong khoa tai khoan Admin de tranh mat quyen quan tri.');
      return;
    }
    if (member.status === 'DELETED') {
      Alert.alert('Khong hop le', 'Tai khoan da vo hieu hoa.');
      return;
    }

    const isLocked = member.status === 'LOCKED';
    Alert.alert(
      isLocked ? 'Mo khoa tai khoan' : 'Khoa tai khoan',
      isLocked ? `Ban muon mo khoa tai khoan ${member.name}?` : `Ban muon khoa tai khoan ${member.name}?`,
      [
        { text: 'Huy', style: 'cancel' },
        {
          text: 'Xac nhan',
          onPress: async () => {
            try {
              if (isLocked) {
                await unlockStaffUser(member._id);
              } else {
                await lockStaffUser(member._id);
              }
              void fetchStaff(true);
            } catch (err: any) {
              Alert.alert('Loi', err.response?.data?.message || 'Khong the cap nhat trang thai tai khoan');
            }
          },
        },
      ],
    );
  }, [canManage, fetchStaff, user]);

  const handleDeactivate = useCallback((member: StaffUser) => {
    if (!canManage) {
      Alert.alert('Khong du quyen', 'Can quyen ADMIN de vo hieu hoa nhan vien.');
      return;
    }
    if (!user) return;
    if (member._id === user.userId) {
      Alert.alert('Khong hop le', 'Khong the vo hieu hoa tai khoan dang dang nhap.');
      return;
    }
    if (member.role === 'SYSTEM_OWNER' || member.role === 'ADMIN') {
      Alert.alert('Khong hop le', 'Khong vo hieu hoa tai khoan quan tri.');
      return;
    }
    if (member.status === 'DELETED') {
      Alert.alert('Thong bao', 'Tai khoan nay da vo hieu hoa.');
      return;
    }

    Alert.alert('Vo hieu hoa nhan vien', `Ban chac chan muon vo hieu hoa ${member.name}?`, [
      { text: 'Huy', style: 'cancel' },
      {
        text: 'Vo hieu hoa',
        style: 'destructive',
        onPress: async () => {
          try {
            await deactivateStaffUser(member._id);
            void fetchStaff(true);
          } catch (err: any) {
            Alert.alert('Loi', err.response?.data?.message || 'Khong the vo hieu hoa nhan vien');
          }
        },
      },
    ]);
  }, [canManage, fetchStaff, user]);

  const handleResetPassword = useCallback((member: StaffUser) => {
    if (!canManage) {
      Alert.alert('Khong du quyen', 'Can quyen ADMIN de reset mat khau.');
      return;
    }
    if (member.role === 'SYSTEM_OWNER') {
      Alert.alert('Khong hop le', 'Khong reset mat khau SYSTEM_OWNER tai day.');
      return;
    }

    Alert.alert('Reset mat khau', `Ban muon reset mat khau cho ${member.name}?`, [
      { text: 'Huy', style: 'cancel' },
      {
        text: 'Reset',
        onPress: async () => {
          try {
            const result = await resetStaffPassword(member._id);
            Alert.alert(
              'Da reset mat khau',
              result.tempPassword
                ? `Mat khau tam thoi: ${result.tempPassword}\nNhan vien nen doi mat khau sau khi dang nhap.`
                : 'Reset mat khau thanh cong.',
            );
          } catch (err: any) {
            Alert.alert('Loi', err.response?.data?.message || 'Khong the reset mat khau');
          }
        },
      },
    ]);
  }, [canManage]);

  if (!user || !MANAGEMENT_ROLES.includes(user.role)) {
    return (
      <View style={styles.screenContainer}>
        <ScreenBackdrop />
        <RestrictedStateView message="Ban khong co quyen truy cap man hinh nhan su." />
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

  const keyword = search.trim().toLowerCase();
  const filteredStaff = staff.filter((member) => {
    if (roleFilter !== 'ALL' && member.role !== roleFilter) {
      return false;
    }
    if (statusFilter !== 'ALL' && member.status !== statusFilter) {
      return false;
    }

    if (!keyword) return true;

    const username = getStaffLoginIdentifier(member).toLowerCase();
    const searchable = `${member.name || ''} ${username} ${member.role}`.toLowerCase();
    return searchable.includes(keyword);
  });

  const activeCount = staff.filter((member) => member.status === 'ACTIVE').length;
  const lockedCount = staff.filter((member) => member.status === 'LOCKED').length;
  const inactiveCount = staff.filter((member) => member.status === 'DELETED').length;

  return (
    <View style={styles.screenContainer}>
      <ScreenBackdrop />
      <ScrollView
        style={styles.screenScroll}
        contentContainerStyle={styles.screenContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void fetchStaff(true)} />}
      >
        <View style={styles.screenStack}>
          <Text style={styles.sectionTitle}>Quan ly nhan su</Text>

          <View style={styles.metricGrid}>
            <View style={[styles.glassCard, styles.metricCard]}>
              <Text style={styles.metricLabel}>Dang hoat dong</Text>
              <Text style={styles.metricValue}>{activeCount}</Text>
            </View>
            <View style={[styles.glassCard, styles.metricCard]}>
              <Text style={styles.metricLabel}>Da khoa</Text>
              <Text style={styles.metricValue}>{lockedCount}</Text>
            </View>
            <View style={[styles.glassCard, styles.metricCard]}>
              <Text style={styles.metricLabel}>Vo hieu hoa</Text>
              <Text style={styles.metricValue}>{inactiveCount}</Text>
            </View>
          </View>

          <View style={[styles.glassCard, styles.inventoryToolbar]}>
            <TextInput
              placeholder="Tim theo ten nhan vien / tai khoan"
              value={search}
              onChangeText={setSearch}
              placeholderTextColor={COLORS.textMuted}
              style={styles.input}
            />

            <Text style={styles.helperText}>Loc theo role</Text>
            <View style={styles.filterRow}>
              {(['ALL', 'ADMIN', 'MANAGER', 'USER', 'KITCHEN'] as const).map((role) => {
                const selected = roleFilter === role;
                return (
                  <TouchableOpacity
                    key={role}
                    activeOpacity={0.8}
                    style={[styles.filterChip, selected ? styles.filterChipActive : null]}
                    onPress={() => setRoleFilter(role)}
                  >
                    <Text style={[styles.filterChipText, selected ? styles.filterChipTextActive : null]}>
                      {role === 'ALL' ? 'Tat ca' : getStaffRoleLabel(role)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.helperText}>Loc theo trang thai</Text>
            <View style={styles.filterRow}>
              {STAFF_STATUS_FILTER_OPTIONS.map((status) => {
                const selected = statusFilter === status;
                return (
                  <TouchableOpacity
                    key={status}
                    activeOpacity={0.8}
                    style={[styles.filterChip, selected ? styles.filterChipActive : null]}
                    onPress={() => setStatusFilter(status)}
                  >
                    <Text style={[styles.filterChipText, selected ? styles.filterChipTextActive : null]}>
                      {status === 'ALL' ? 'Tat ca' : getStaffStatusLabel(status)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {canManage ? (
              <TouchableOpacity activeOpacity={0.8} style={[styles.buttonBase, styles.buttonPrimary]} onPress={openCreateForm}>
                <Text style={styles.buttonText}>Them nhan vien</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity activeOpacity={1} disabled style={[styles.buttonBase, styles.buttonSecondary, styles.moduleCardDisabled]}>
                <Text style={styles.buttonText}>Them nhan vien</Text>
              </TouchableOpacity>
            )}

            {!canManage ? <Text style={styles.helperText}>Can quyen ADMIN de thay doi nhan su.</Text> : null}
          </View>

          {formMode ? (
            <View style={[styles.glassCard, styles.formCard]}>
              <Text style={styles.sectionTitle}>{formMode === 'create' ? 'Them nhan vien' : 'Sua nhan vien'}</Text>
              {formError ? <Text style={styles.errorText}>{formError}</Text> : null}

              <TextInput
                placeholder="Ten nhan vien"
                value={formName}
                onChangeText={setFormName}
                placeholderTextColor={COLORS.textMuted}
                style={styles.input}
              />
              <TextInput
                placeholder="Ten tai khoan (email hoac so dien thoai)"
                value={formUsername}
                onChangeText={setFormUsername}
                placeholderTextColor={COLORS.textMuted}
                style={styles.input}
                autoCapitalize="none"
              />
              <TextInput
                placeholder="Luong theo gio (tuy chon)"
                value={formHourlyWage}
                onChangeText={setFormHourlyWage}
                placeholderTextColor={COLORS.textMuted}
                style={styles.input}
                keyboardType="decimal-pad"
              />

              <View style={[styles.glassCard, styles.disabledBlock]}>
                <Text style={styles.sectionTitle}>Vi tri lam viec</Text>
                <Text style={styles.helperText}>Backend chua ho tro truong vi tri lam viec.</Text>
              </View>

              <Text style={styles.helperText}>Role nhan vien</Text>
              <View style={styles.filterRow}>
                {(formMode === 'create' ? STAFF_CREATE_ROLE_OPTIONS : STAFF_EDIT_ROLE_OPTIONS).map((role) => {
                  const selected = formRole === role;
                  const disableRoleSelection =
                    (formMode === 'edit' && editingMember?.role === 'ADMIN' && role !== 'ADMIN') ||
                    (formMode === 'edit' && editingMember?._id === user.userId && role !== editingMember.role);
                  return (
                    <TouchableOpacity
                      key={role}
                      activeOpacity={0.8}
                      disabled={disableRoleSelection}
                      style={[
                        styles.filterChip,
                        selected ? styles.filterChipActive : null,
                        disableRoleSelection ? styles.moduleCardDisabled : null,
                      ]}
                      onPress={() => setFormRole(role)}
                    >
                      <Text style={[styles.filterChipText, selected ? styles.filterChipTextActive : null]}>{getStaffRoleLabel(role)}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {formMode === 'create' ? <Text style={styles.helperText}>Mat khau mac dinh: 1</Text> : null}

              <View style={styles.rowSplit}>
                <TouchableOpacity activeOpacity={0.8} style={[styles.buttonBase, styles.buttonSecondary, styles.flex1]} onPress={resetForm}>
                  <Text style={styles.buttonText}>Huy</Text>
                </TouchableOpacity>
                <TouchableOpacity activeOpacity={0.8} style={[styles.buttonBase, styles.buttonPrimary, styles.flex1]} onPress={() => void saveStaffForm()}>
                  {formSubmitting ? <ActivityIndicator color={COLORS.text} /> : <Text style={styles.buttonText}>Luu nhan vien</Text>}
                </TouchableOpacity>
              </View>
            </View>
          ) : null}

          {creationNote ? <Text style={styles.otpNotice}>{creationNote}</Text> : null}

          {loadError ? <ErrorStateView message={loadError} onRetry={() => void fetchStaff()} /> : null}

          {!loadError && filteredStaff.length === 0 ? (
            <EmptyStateView message="Khong co nhan vien nao phu hop bo loc." />
          ) : (
            filteredStaff.map((member) => {
              const statusStyle =
                member.status === 'LOCKED' ? styles.statusPending : member.status === 'DELETED' ? styles.statusLowStock : styles.statusProgress;
              const username = getStaffLoginIdentifier(member) || 'Chua co ten tai khoan';
              const canEdit = canManage && member.role !== 'SYSTEM_OWNER';
              const canDeactivate =
                canManage && member._id !== user.userId && member.role !== 'SYSTEM_OWNER' && member.role !== 'ADMIN' && member.status !== 'DELETED';
              const canResetPassword = canManage && member.role !== 'SYSTEM_OWNER';
              const canToggleLock =
                canManage &&
                member._id !== user.userId &&
                member.role !== 'SYSTEM_OWNER' &&
                member.status !== 'DELETED' &&
                (member.role !== 'ADMIN' || member.status === 'LOCKED');

              return (
                <View key={member._id} style={[styles.glassCard, styles.staffCard]}>
                  <View style={styles.staffHeader}>
                    <View style={styles.staffInfo}>
                      <Text style={styles.staffName}>{member.name || 'Nhan vien'}</Text>
                      <Text style={styles.staffMeta}>Ten tai khoan: {username}</Text>
                      <Text style={styles.staffMeta}>Role: {getStaffRoleLabel(member.role)}</Text>
                      <Text style={styles.staffMeta}>Vi tri lam viec: Backend chua ho tro</Text>
                      <Text style={styles.staffMeta}>
                        Luong theo gio:{' '}
                        {member.salaryConfig?.baseHourly === undefined || member.salaryConfig?.baseHourly === null
                          ? 'Backend chua co'
                          : `${member.salaryConfig.baseHourly.toLocaleString()}d`}
                      </Text>
                      <Text style={styles.staffMeta}>Tao luc: {member.createdAt ? new Date(member.createdAt).toLocaleString() : '-'}</Text>
                    </View>
                    <View style={[styles.statusBadge, statusStyle]}>
                      <Text style={styles.statusText}>{getStaffStatusLabel(member.status)}</Text>
                    </View>
                  </View>

                  <View style={styles.inventoryActionRow}>
                    {canEdit ? (
                      <TouchableOpacity activeOpacity={0.8} style={[styles.buttonBase, styles.buttonSecondary, styles.flex1]} onPress={() => openEditForm(member)}>
                        <Text style={styles.buttonText}>Sua nhan vien</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity activeOpacity={1} disabled style={[styles.buttonBase, styles.buttonSecondary, styles.flex1, styles.moduleCardDisabled]}>
                        <Text style={styles.buttonText}>Sua nhan vien</Text>
                      </TouchableOpacity>
                    )}

                    {canToggleLock ? (
                      <TouchableOpacity
                        activeOpacity={0.8}
                        style={[styles.buttonBase, member.status === 'LOCKED' ? styles.buttonPrimary : styles.buttonAmber, styles.flex1]}
                        onPress={() => handleToggleLock(member)}
                      >
                        <Text style={styles.buttonText}>{member.status === 'LOCKED' ? 'Mo khoa tai khoan' : 'Khoa tai khoan'}</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity activeOpacity={1} disabled style={[styles.buttonBase, styles.buttonSecondary, styles.flex1, styles.moduleCardDisabled]}>
                        <Text style={styles.buttonText}>{member.status === 'LOCKED' ? 'Mo khoa tai khoan' : 'Khoa tai khoan'}</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  <View style={styles.inventoryActionRow}>
                    {canResetPassword ? (
                      <TouchableOpacity activeOpacity={0.8} style={[styles.buttonBase, styles.buttonPrimary, styles.flex1]} onPress={() => handleResetPassword(member)}>
                        <Text style={styles.buttonText}>Reset mat khau</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity activeOpacity={1} disabled style={[styles.buttonBase, styles.buttonSecondary, styles.flex1, styles.moduleCardDisabled]}>
                        <Text style={styles.buttonText}>Reset mat khau</Text>
                      </TouchableOpacity>
                    )}

                    {canDeactivate ? (
                      <TouchableOpacity activeOpacity={0.8} style={[styles.buttonBase, styles.buttonAmber, styles.flex1]} onPress={() => handleDeactivate(member)}>
                        <Text style={styles.buttonText}>Vo hieu hoa</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity activeOpacity={1} disabled style={[styles.buttonBase, styles.buttonSecondary, styles.flex1, styles.moduleCardDisabled]}>
                        <Text style={styles.buttonText}>Vo hieu hoa</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function SystemOwnerScreen() {
  const { user } = useAuth();
  const [tenants, setTenants] = useState<any[]>([]);
  const [screenLoading, setScreenLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');

  const fetchTenants = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setScreenLoading(true);
      }
      setLoadError('');
      const res = await api.get('/tenants');
      setTenants(Array.isArray(res.data) ? res.data : []);
    } catch (err: any) {
      setLoadError(err.response?.data?.message || 'Khong the tai danh sach tenants');
    } finally {
      setScreenLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchTenants();
  }, [fetchTenants]);

  const toggleTenantLock = useCallback(
    (tenantId: string, status: string) => {
      const isLocked = status === 'SUSPENDED';
      Alert.alert(
        isLocked ? 'Mo khoa tenant' : 'Khoa tenant',
        isLocked ? 'Ban muon mo khoa tenant nay?' : 'Ban muon khoa tenant nay?',
        [
          { text: 'Huy', style: 'cancel' },
          {
            text: 'Dong y',
            onPress: async () => {
              try {
                await api.patch(`/tenants/${tenantId}/${isLocked ? 'unlock' : 'lock'}`);
                void fetchTenants(true);
              } catch (err: any) {
                Alert.alert('Loi', err.response?.data?.message || 'Khong the cap nhat tenant');
              }
            },
          },
        ],
      );
    },
    [fetchTenants],
  );

  if (!user || user.role !== 'SYSTEM_OWNER') {
    return (
      <View style={styles.screenContainer}>
        <ScreenBackdrop />
        <RestrictedStateView message="Ban khong co quyen truy cap man hinh SaaS owner." />
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void fetchTenants(true)} />}
      >
        <View style={styles.screenStack}>
          <Text style={styles.sectionTitle}>Quan ly Tenants (SaaS)</Text>

          {loadError ? <ErrorStateView message={loadError} onRetry={() => void fetchTenants()} /> : null}

          {!loadError && tenants.length === 0 ? (
            <EmptyStateView message="Chua co tenant nao." />
          ) : (
            tenants.map((tenant) => (
              <View key={tenant._id} style={[styles.glassCard, styles.staffCard]}>
                <Text style={styles.bentoTitle}>{tenant.name}</Text>
                <Text style={styles.historyText}>Subdomain: {tenant.subdomain || '-'}</Text>
                <Text style={styles.historyText}>Status: {tenant.status}</Text>
                <Text style={styles.historyText}>Owner: {tenant.ownerName || '-'}</Text>

                {tenant.status === 'DELETED' ? null : (
                  <TouchableOpacity
                    activeOpacity={0.8}
                    style={[styles.buttonBase, tenant.status === 'SUSPENDED' ? styles.buttonPrimary : styles.buttonAmber, styles.buttonTopSpace]}
                    onPress={() => toggleTenantLock(tenant._id, tenant.status)}
                  >
                    <Text style={styles.buttonText}>{tenant.status === 'SUSPENDED' ? 'Mo Khoa Tenant' : 'Khoa Tenant'}</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function getTabScreensForRole(role: SessionUser['role']) {
  return {
    showShift: SHIFT_ROLES.includes(role),
    showOrders: ORDER_ROLES.includes(role),
    showManagement: MANAGEMENT_ROLES.includes(role),
  };
}

function isAdminDashboardRole(role: SessionUser['role']) {
  return ADMIN_DASHBOARD_ROLES.includes(role);
}

function getInitialTabRouteForRole(role: SessionUser['role']) {
  if (MANAGEMENT_ROLES.includes(role)) return 'Quan Ly';
  if (SHIFT_ROLES.includes(role)) return 'Ca Lam';
  if (ORDER_ROLES.includes(role)) return 'Don Hang';
  return undefined;
}

export default function App() {
  const [token, setToken] = useState('');
  const [user, setUser] = useState<SessionUser | null>(null);
  const [deviceId, setDeviceId] = useState('');

  const [bootstrapping, setBootstrapping] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [requiresOtp, setRequiresOtp] = useState(false);
  const [verifyUserId, setVerifyUserId] = useState('');
  const [requiresPasswordChange, setRequiresPasswordChange] = useState(false);
  const [tempToken, setTempToken] = useState('');
  const [socketReady, setSocketReady] = useState(false);

  const socketRef = useRef<any>(null);
  const unauthorizedHandledRef = useRef(false);

  const resetOtpFlow = useCallback(() => {
    setRequiresOtp(false);
    setVerifyUserId('');
    setError('');
  }, []);

  const cleanSocket = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    setSocketReady(false);
  }, []);

  const resetAuthState = useCallback(() => {
    setToken('');
    setUser(null);
    setRequiresOtp(false);
    setVerifyUserId('');
    setRequiresPasswordChange(false);
    setTempToken('');
    setError('');
    setApiToken('');
    setSocketReady(false);
  }, []);

  const handleLogout = useCallback(async () => {
    cleanSocket();
    resetAuthState();
    unauthorizedHandledRef.current = false;
    await clearAccessToken();
  }, [cleanSocket, resetAuthState]);

  const applyAccessToken = useCallback(async (nextToken: string, persist: boolean) => {
    const payload = parseJwt(nextToken);
    if (!payload || isTokenExpired(payload)) {
      throw new Error('Token khong hop le hoac da het han');
    }

    const nextUser = userFromTokenPayload(payload);
    if (!nextUser || !VALID_ROLES.includes(nextUser.role)) {
      throw new Error('Role khong hop le');
    }

    setToken(nextToken);
    setUser(nextUser);
    setApiToken(nextToken);

    if (persist) {
      await saveAccessToken(nextToken);
    }
  }, []);

  const handleUnauthorized = useCallback(() => {
    if (unauthorizedHandledRef.current) return;
    unauthorizedHandledRef.current = true;

    void (async () => {
      await handleLogout();
      Alert.alert('Phien dang nhap da het han', 'Vui long dang nhap lai de tiep tuc.');
    })();
  }, [handleLogout]);

  useEffect(() => {
    const detach = attachApiInterceptors(handleUnauthorized);
    return detach;
  }, [handleUnauthorized]);

  useEffect(() => {
    let mounted = true;

    const bootstrap = async () => {
      try {
        const [savedToken, nextDeviceId] = await Promise.all([loadAccessToken(), getOrCreateDeviceId()]);
        if (!mounted) return;

        setDeviceId(nextDeviceId);

        if (!savedToken) {
          setBootstrapping(false);
          return;
        }

        const payload = parseJwt(savedToken);
        const restoredUser = payload ? userFromTokenPayload(payload) : null;
        if (!payload || isTokenExpired(payload) || !restoredUser) {
          await clearAccessToken();
          setBootstrapping(false);
          return;
        }

        setToken(savedToken);
        setUser(restoredUser);
        setApiToken(savedToken);
      } catch {
        await clearAccessToken();
      } finally {
        if (mounted) {
          setBootstrapping(false);
        }
      }
    };

    void bootstrap();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!token || !user) {
      cleanSocket();
      return;
    }

    const socket = io(API_BASE_URL, { transports: ['websocket'] });
    socketRef.current = socket;
    setSocketReady(true);

    socket.on('connect', () => {
      if (user.tenantId) {
        socket.emit('register', { tenantId: user.tenantId, userId: user.userId });
      }
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setSocketReady(false);
    };
  }, [token, user, cleanSocket]);

  const handleLogin = useCallback(
    async (email: string, phone: string, pass: string) => {
      if (!deviceId) {
        setError('Dang khoi tao thiet bi. Vui long thu lai.');
        return;
      }

      setError('');
      setLoading(true);

      try {
        const res = await api.post('/auth/login', {
          email: email || undefined,
          phone: phone || undefined,
          password: pass,
          deviceId,
        });

        if (res.data.requiresDeviceVerification) {
          setRequiresOtp(true);
          setVerifyUserId(res.data.userId);
          setError('Thiet bi moi. Vui long lay ma OTP tu Admin.');
          return;
        }

        if (res.data.requiresPasswordChange) {
          setRequiresPasswordChange(true);
          setTempToken(res.data.tempToken || '');
          return;
        }

        if (!res.data.access_token) {
          throw new Error('Khong nhan duoc access token');
        }

        await applyAccessToken(res.data.access_token, true);
      } catch (err: any) {
        setError(err.response?.data?.message || err.message || 'Dang nhap that bai.');
      } finally {
        setLoading(false);
      }
    },
    [applyAccessToken, deviceId],
  );

  const handleVerifyDevice = useCallback(
    async (otpCode: string) => {
      if (!verifyUserId) {
        setError('Khong tim thay thong tin xac thuc thiet bi.');
        return;
      }

      setError('');
      setLoading(true);

      try {
        const res = await api.post('/auth/verify-device', { userId: verifyUserId, otpCode, deviceId });
        if (!res.data.access_token) {
          throw new Error('Khong nhan duoc access token');
        }

        await applyAccessToken(res.data.access_token, true);
        resetOtpFlow();
      } catch (err: any) {
        setError(err.response?.data?.message || 'OTP khong hop le.');
      } finally {
        setLoading(false);
      }
    },
    [verifyUserId, deviceId, applyAccessToken, resetOtpFlow],
  );

  const handleChangePassword = useCallback(
    async (currentPassword: string, newPassword: string) => {
      if (!tempToken) {
        setError('Phien doi mat khau da het han. Vui long dang nhap lai.');
        return;
      }

      setError('');
      setLoading(true);

      try {
        const res = await api.post(
          '/auth/change-password',
          { currentPassword, newPassword },
          { headers: { Authorization: `Bearer ${tempToken}` } },
        );

        setRequiresPasswordChange(false);
        setTempToken('');

        if (!res.data.access_token) {
          throw new Error('Khong nhan duoc access token moi');
        }

        await applyAccessToken(res.data.access_token, true);
        Alert.alert('Thanh cong', 'Doi mat khau thanh cong');
      } catch (err: any) {
        setError(err.response?.data?.message || 'Doi mat khau that bai.');
      } finally {
        setLoading(false);
      }
    },
    [tempToken, applyAccessToken],
  );

  const handlePasswordChangeCancel = useCallback(async () => {
    await handleLogout();
  }, [handleLogout]);

  const authContextValue: AuthContextValue = {
    token,
    user,
    deviceId,
    socketReady,
    socketRef,
    loading,
    error,
    requiresOtp,
    requiresPasswordChange,
    tempToken,
    handleLogin,
    handleVerifyDevice,
    handleChangePassword,
    handlePasswordChangeCancel,
    handleLogout,
    resetOtpFlow,
  };

  if (bootstrapping) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" />
        <ScreenBackdrop />
        <LoadingView />
      </View>
    );
  }

  const tabRoleState = user ? getTabScreensForRole(user.role) : null;
  const hasAnyTab = Boolean(tabRoleState && (tabRoleState.showShift || tabRoleState.showOrders || tabRoleState.showManagement));
  const initialTabRoute = user ? getInitialTabRouteForRole(user.role) : undefined;
  const isAdminTabFlow = user ? isAdminDashboardRole(user.role) : false;

  return (
    <AuthContext.Provider value={authContextValue}>
      <NavigationContainer
        theme={{
          ...DarkTheme,
          colors: {
            ...DarkTheme.colors,
            primary: COLORS.primary,
            background: COLORS.background,
            card: COLORS.surfaceCard,
            text: COLORS.text,
            border: COLORS.border,
            notification: COLORS.secondary,
          },
        }}
      >
        {!token && !requiresPasswordChange ? (
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Auth" component={AuthScreen} />
          </Stack.Navigator>
        ) : requiresPasswordChange ? (
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
          </Stack.Navigator>
        ) : !user ? (
          <View style={styles.container}>
            <LoadingView />
          </View>
        ) : user.role === 'SYSTEM_OWNER' ? (
          <Stack.Navigator
            screenOptions={{
              headerStyle: styles.header as any,
              headerTintColor: COLORS.text,
              headerTitleStyle: styles.headerTitle as any,
              headerRight: () => (
                <TouchableOpacity activeOpacity={0.8} onPress={() => void handleLogout()} style={styles.headerRight}>
                  <LogOut color={COLORS.secondary} size={SIZES.iconLg} />
                </TouchableOpacity>
              ),
            }}
          >
            <Stack.Screen name="Quan Tri SaaS" component={SystemOwnerScreen} />
          </Stack.Navigator>
        ) : !hasAnyTab ? (
          <View style={styles.screenContainer}>
            <ScreenBackdrop />
            <RestrictedStateView message="Tai khoan cua ban khong co man hinh quan tri hop le." actionText="Dang xuat" onAction={() => void handleLogout()} />
          </View>
        ) : (
          <Tab.Navigator
            initialRouteName={initialTabRoute}
            screenOptions={({ route }) => ({
              headerStyle: styles.header as any,
              headerTintColor: COLORS.text,
              headerTitleStyle: styles.headerTitle as any,
              headerRight: () => (
                <TouchableOpacity activeOpacity={0.8} onPress={() => void handleLogout()} style={styles.headerRight}>
                  <LogOut color={COLORS.secondary} size={SIZES.iconLg} />
                </TouchableOpacity>
              ),
              tabBarActiveTintColor: COLORS.primaryLight,
              tabBarInactiveTintColor: COLORS.textMuted,
              tabBarStyle: styles.tabBar,
              tabBarLabelStyle: styles.tabBarLabel,
              tabBarIcon: ({ color, size }) => {
                if (route.name === 'Ca Lam') return <Calendar color={color} size={size} />;
                if (route.name === 'Don Hang') return <Coffee color={color} size={size} />;
                if (route.name === 'Quan Ly') return <Users color={color} size={size} />;
                if (route.name === 'Nhan Su') return <Users color={color} size={size} />;
                if (route.name === 'Kho') return <Home color={color} size={size} />;
                if (route.name === 'Menu') return <Coffee color={color} size={size} />;
                if (route.name === 'Ban') return <Home color={color} size={size} />;
                if (route.name === 'Cham Cong') return <Calendar color={color} size={size} />;
                if (route.name === 'Bang Luong') return <CheckCircle color={color} size={size} />;
                return <Home color={color} size={size} />;
              },
            })}
          >
            {isAdminTabFlow ? (
              <>
                {tabRoleState?.showManagement ? <Tab.Screen name="Quan Ly" component={AdminDashboardScreen} /> : null}
                {tabRoleState?.showManagement ? <Tab.Screen name="Kho" component={InventoryScreen} /> : null}
                {tabRoleState?.showManagement ? <Tab.Screen name="Menu" component={MenuManagementScreen} /> : null}
                {tabRoleState?.showManagement ? <Tab.Screen name="Ban" component={TableManagementScreen} /> : null}
                {tabRoleState?.showManagement ? <Tab.Screen name="Nhan Su" component={StaffManagementScreen} /> : null}
                {tabRoleState?.showManagement ? <Tab.Screen name="Cham Cong" component={AttendanceManagementScreen} /> : null}
                {tabRoleState?.showManagement ? <Tab.Screen name="Bang Luong" component={PayrollManagementScreen} /> : null}
                {tabRoleState?.showOrders ? <Tab.Screen name="Don Hang" component={OrderScreen} /> : null}
              </>
            ) : (
              <>
                {tabRoleState?.showShift ? <Tab.Screen name="Ca Lam" component={ShiftScreen} /> : null}
                {tabRoleState?.showOrders ? <Tab.Screen name="Don Hang" component={OrderScreen} /> : null}
              </>
            )}
          </Tab.Navigator>
        )}
      </NavigationContainer>
    </AuthContext.Provider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
  },
  screenContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  screenScroll: {
    flex: 1,
  },
  screenContent: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.xxl,
    paddingBottom: SPACING.xxxl,
  },
  screenStack: {
    rowGap: SPACING.xl,
    width: '100%',
  },
  backgroundGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  backgroundBase: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.background,
  },
  glowTopLeft: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: 'rgba(16,185,129,0.12)',
    top: -80,
    left: -40,
  },
  glowBottomRight: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(168,85,247,0.12)',
    bottom: -120,
    right: -60,
  },
  glassCard: {
    backgroundColor: COLORS.surface,
    borderRadius: SIZES.radiusXl,
    padding: SPACING.xxl,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.card,
  },
  authCard: {
    width: '100%',
  },
  authHeader: {
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  brandTitle: {
    ...TYPOGRAPHY.hero,
    color: COLORS.text,
    textAlign: 'center',
    letterSpacing: SPACING.xs,
    textTransform: 'uppercase',
  },
  brandSubtitle: {
    ...TYPOGRAPHY.subtitle,
    color: COLORS.primary,
    textAlign: 'center',
  },
  errorText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.error,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  formStack: {
    width: '100%',
    rowGap: SPACING.md,
  },
  helperText: {
    ...TYPOGRAPHY.tiny,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
  input: {
    height: SIZES.inputHeight,
    borderRadius: SIZES.radiusMd,
    backgroundColor: 'rgba(5,5,8,0.6)',
    borderColor: COLORS.border,
    borderWidth: 1,
    paddingHorizontal: SPACING.lg,
    color: COLORS.text,
    ...TYPOGRAPHY.body,
  },
  inputOtp: {
    textAlign: 'center',
    letterSpacing: 8,
    fontSize: 24,
    fontWeight: '700',
  },
  otpNotice: {
    ...TYPOGRAPHY.caption,
    color: COLORS.warning,
    textAlign: 'center',
  },
  rowSplit: {
    flexDirection: 'row',
    columnGap: SPACING.md,
  },
  flex1: {
    flex: 1,
  },
  buttonBase: {
    height: SIZES.buttonHeight,
    borderRadius: SIZES.radiusMd,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    columnGap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
  },
  buttonPrimary: {
    backgroundColor: COLORS.primary,
    ...SHADOWS.glowGreen,
  },
  buttonSecondary: {
    backgroundColor: COLORS.surfaceLight,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  buttonAmber: {
    backgroundColor: COLORS.secondary,
    shadowColor: COLORS.secondary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 7,
  },
  buttonSuccess: {
    backgroundColor: COLORS.primary,
    ...SHADOWS.glowGreen,
  },
  buttonTopSpace: {
    marginTop: SPACING.md,
  },
  buttonText: {
    color: COLORS.text,
    fontSize: TYPOGRAPHY.body.fontSize,
    fontWeight: '700',
  },
  sectionTitle: {
    ...TYPOGRAPHY.title,
    color: COLORS.text,
  },
  sectionTitleSpacing: {
    marginTop: SPACING.xxl,
  },
  bentoRow: {
    flexDirection: 'row',
    columnGap: SPACING.md,
  },
  bentoCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xxl,
    paddingHorizontal: SPACING.lg,
    borderRadius: SIZES.radiusXl,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    rowGap: SPACING.sm,
    ...SHADOWS.card,
  },
  bentoCardGreen: {
    borderColor: 'rgba(16,185,129,0.35)',
    shadowColor: COLORS.glowGreen,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 18,
    elevation: 8,
  },
  bentoCardAmber: {
    borderColor: 'rgba(245,158,11,0.35)',
    shadowColor: COLORS.secondary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 7,
  },
  iconBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  iconBadgeGreen: {
    backgroundColor: 'rgba(16,185,129,0.12)',
    borderColor: 'rgba(16,185,129,0.3)',
  },
  iconBadgeAmber: {
    backgroundColor: 'rgba(245,158,11,0.12)',
    borderColor: 'rgba(245,158,11,0.3)',
  },
  bentoTitle: {
    ...TYPOGRAPHY.subtitle,
    color: COLORS.text,
  },
  historyCard: {
    backgroundColor: 'rgba(20,20,30,0.6)',
    borderRadius: SIZES.radiusMd,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    rowGap: SPACING.xs,
    ...SHADOWS.card,
  },
  historyText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSoft,
  },
  historyTextStrong: {
    fontSize: TYPOGRAPHY.body.fontSize,
    fontWeight: '700',
    color: COLORS.primaryLight,
  },
  kitchenCard: {
    marginBottom: SPACING.lg,
  },
  kitchenTableText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSoft,
  },
  kitchenItemText: {
    ...TYPOGRAPHY.title,
    color: COLORS.text,
    marginVertical: SPACING.sm,
  },
  kitchenNote: {
    ...TYPOGRAPHY.caption,
    color: COLORS.warning,
    marginBottom: SPACING.sm,
  },
  orderCard: {
    marginBottom: SPACING.lg,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  orderTableText: {
    ...TYPOGRAPHY.subtitle,
    color: COLORS.text,
  },
  statusBadge: {
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusPending: {
    backgroundColor: 'rgba(245,158,11,0.15)',
    borderColor: 'rgba(245,158,11,0.35)',
  },
  statusProgress: {
    backgroundColor: 'rgba(16,185,129,0.15)',
    borderColor: 'rgba(16,185,129,0.35)',
  },
  statusLowStock: {
    backgroundColor: 'rgba(245,158,11,0.15)',
    borderColor: 'rgba(245,158,11,0.35)',
  },
  statusText: {
    ...TYPOGRAPHY.tiny,
    color: COLORS.text,
    fontWeight: '600',
  },
  orderItems: {
    rowGap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  orderItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderItemText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text,
    flex: 1,
    paddingRight: SPACING.md,
  },
  itemStatus: {
    ...TYPOGRAPHY.tiny,
  },
  itemStatusReady: {
    color: COLORS.success,
  },
  itemStatusPreparing: {
    color: COLORS.primaryLight,
  },
  itemStatusDefault: {
    color: COLORS.textMuted,
  },
  metricGrid: {
    rowGap: SPACING.md,
  },
  moduleGrid: {
    rowGap: SPACING.md,
  },
  inventoryToolbar: {
    rowGap: SPACING.md,
  },
  formCard: {
    rowGap: SPACING.md,
  },
  disabledBlock: {
    padding: SPACING.lg,
    borderStyle: 'dashed',
    borderColor: COLORS.border,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  filterChip: {
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.md,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: 'rgba(10,12,20,0.65)',
  },
  filterChipActive: {
    borderColor: 'rgba(16,185,129,0.35)',
    backgroundColor: 'rgba(16,185,129,0.15)',
  },
  filterChipText: {
    ...TYPOGRAPHY.tiny,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: COLORS.primaryLight,
  },
  inventoryItemCard: {
    rowGap: SPACING.md,
  },
  inventoryActionRow: {
    flexDirection: 'row',
    columnGap: SPACING.sm,
  },
  moduleCard: {
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.lg,
    rowGap: SPACING.sm,
  },
  moduleCardDisabled: {
    opacity: 0.7,
  },
  moduleLabel: {
    ...TYPOGRAPHY.subtitle,
    color: COLORS.text,
  },
  moduleMeta: {
    ...TYPOGRAPHY.caption,
    color: COLORS.primaryLight,
  },
  moduleBadge: {
    alignSelf: 'flex-start',
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.35)',
    backgroundColor: 'rgba(245,158,11,0.15)',
  },
  moduleBadgeText: {
    ...TYPOGRAPHY.tiny,
    color: COLORS.warning,
    fontWeight: '600',
  },
  metricCard: {
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.lg,
  },
  metricLabel: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textMuted,
    marginBottom: SPACING.xs,
  },
  metricValue: {
    ...TYPOGRAPHY.title,
    color: COLORS.text,
  },
  staffCard: {
    rowGap: SPACING.md,
  },
  staffHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    columnGap: SPACING.md,
  },
  staffInfo: {
    flex: 1,
    rowGap: SPACING.xs,
  },
  staffName: {
    ...TYPOGRAPHY.subtitle,
    color: COLORS.text,
  },
  staffMeta: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSoft,
  },
  header: {
    backgroundColor: COLORS.surfaceCard,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 6,
  },
  headerTitle: {
    ...TYPOGRAPHY.body,
    fontWeight: '600',
    color: COLORS.text,
  },
  headerRight: {
    marginRight: SPACING.lg,
  },
  tabBar: {
    backgroundColor: COLORS.surfaceCard,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.md,
  },
  tabBarLabel: {
    ...TYPOGRAPHY.tiny,
    fontWeight: '600',
  },
});
