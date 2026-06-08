import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { api } from '../../services/api';
import { getActiveOrders, type ActiveOrder } from '../../services/order';
import { MANAGEMENT_ROLES } from '../../constants/roles';
import { formatCurrencyVnd } from '../../utils/format';
import { useAuth } from '../../auth/AuthContext';
import { ScreenBackdrop } from '../../components/common/ScreenBackdrop';
import { ErrorStateView, LoadingView, RestrictedStateView } from '../../components/StateViews';
import { AdminTopBar } from './components/AdminTopBar';
import { AdminMetricCard } from './components/AdminMetricCard';
import { ActiveOrdersPanel } from './components/ActiveOrdersPanel';
import { ModuleLauncherGrid, type AdminModuleCard, type AdminModuleRoute } from './components/ModuleLauncherGrid';
import { RevenueBarChart, type RevenueHourPoint } from './components/RevenueBarChart';
import { StockAlertsPanel, type StockAlertItem } from './components/StockAlertsPanel';

type DashboardData = {
  today?: {
    revenue?: number;
    yesterdayRevenue?: number;
    avgDailyRevenue?: number;
    completedOrders?: number;
    pendingOrders?: number;
    inProgressOrders?: number;
    cancelledOrders?: number;
    activeOrders?: number;
  };
  topItems?: Array<{ itemId?: string; name?: string; count?: number; revenue?: number }>;
  stockAlerts?: StockAlertItem[];
};

const MODULES: AdminModuleCard[] = [
  { key: 'inventory', label: 'Kho', routeName: 'Kho' },
  { key: 'menu', label: 'Menu', routeName: 'Menu' },
  { key: 'tables', label: 'Bàn', routeName: 'Ban' },
  { key: 'staff', label: 'Nhân sự', routeName: 'Nhan Su' },
  { key: 'attendance', label: 'Chấm công', routeName: 'Cham Cong' },
  { key: 'payroll', label: 'Bảng lương', routeName: 'Bang Luong' },
  { key: 'orders', label: 'Đơn hàng', routeName: 'Don Hang' },
];

function getMetricColumns(width: number) {
  if (width >= 900) return 4;
  if (width >= 600) return 2;
  return 1;
}

function getModuleColumns(width: number) {
  if (width >= 900) return 4;
  if (width >= 600) return 2;
  return 1;
}

function getCardWidth(columns: number): number | `${number}%` {
  if (columns >= 4) return '23.5%';
  if (columns === 2) return '48.5%';
  return '100%';
}

export default function AdminDashboardScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<any>();
  const { width } = useWindowDimensions();

  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [hourlyRevenue, setHourlyRevenue] = useState<RevenueHourPoint[]>([]);
  const [activeOrders, setActiveOrders] = useState<ActiveOrder[]>([]);
  const [screenLoading, setScreenLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');

  const metricColumns = getMetricColumns(width);
  const moduleColumns = getModuleColumns(width);
  const metricWidth = getCardWidth(metricColumns);
  const isWide = width >= 900;

  const fetchDashboardData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setScreenLoading(true);
      }
      setLoadError('');

      const [dashboardRes, revenueRes, ordersRes] = await Promise.all([
        api.get('/reports/dashboard'),
        api.get('/reports/revenue-by-hour'),
        getActiveOrders(),
      ]);

      setDashboard((dashboardRes.data || null) as DashboardData | null);
      setHourlyRevenue(Array.isArray(revenueRes.data) ? (revenueRes.data as RevenueHourPoint[]) : []);
      setActiveOrders(ordersRes);
    } catch (err: any) {
      setLoadError(err.response?.data?.message || 'Không thể tải dữ liệu tổng quan');
    } finally {
      setScreenLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchDashboardData();
  }, [fetchDashboardData]);

  const hourlyRevenueValues = useMemo(() => hourlyRevenue.map((point) => point.revenue), [hourlyRevenue]);
  const hourlyOrderValues = useMemo(() => hourlyRevenue.map((point) => point.orderCount), [hourlyRevenue]);

  if (!user || !MANAGEMENT_ROLES.includes(user.role)) {
    return (
      <View style={styles.screenContainer}>
        <ScreenBackdrop />
        <RestrictedStateView message="Bạn không có quyền truy cập màn hình quản lý." />
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

  const today = dashboard?.today || {};
  const stockAlerts = dashboard?.stockAlerts || [];
  const topItems = dashboard?.topItems || [];
  const pendingAndProgress = (today.pendingOrders || 0) + (today.inProgressOrders || 0);

  const metrics = [
    {
      label: 'Doanh thu hôm nay',
      value: formatCurrencyVnd(today.revenue || 0),
      subLabel: `TB 7 ngày: ${formatCurrencyVnd(today.avgDailyRevenue || 0)}`,
      accentColor: '#34D399',
      sparklineValues: hourlyRevenueValues,
    },
    {
      label: 'Đơn đang xử lý',
      value: today.activeOrders ?? activeOrders.length,
      subLabel: `${pendingAndProgress} đơn chờ/bếp`,
      accentColor: '#F59E0B',
      sparklineValues: hourlyOrderValues,
    },
    {
      label: 'Đơn hoàn thành',
      value: today.completedOrders || 0,
      subLabel: `${today.cancelledOrders || 0} đơn đã hủy`,
      accentColor: '#22D3EE',
      sparklineValues: hourlyOrderValues,
    },
    {
      label: 'Cảnh báo kho',
      value: stockAlerts.length,
      subLabel: stockAlerts.length ? 'Cần kiểm tra nguyên liệu' : 'Kho đang ổn định',
      accentColor: '#FB7185',
      sparklineValues: [],
    },
  ];

  return (
    <View style={styles.screenContainer}>
      <ScreenBackdrop />
      <ScrollView
        style={styles.screenScroll}
        contentContainerStyle={[styles.screenContent, isWide ? styles.screenContentWide : null]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void fetchDashboardData(true)} />}
      >
        <View style={styles.stack}>
          <AdminTopBar user={user} isWide={isWide} />

          <View style={styles.pageHeader}>
            <View>
              <Text style={styles.title}>Tổng quan</Text>
              <Text style={styles.subtitle}>Bảng điều khiển vận hành cửa hàng</Text>
            </View>
          </View>

          {loadError ? <ErrorStateView message={loadError} onRetry={() => void fetchDashboardData()} /> : null}

          {!loadError ? (
            <>
              <View style={styles.metricGrid}>
                {metrics.map((metric) => (
                  <AdminMetricCard
                    key={metric.label}
                    label={metric.label}
                    value={metric.value}
                    subLabel={metric.subLabel}
                    accentColor={metric.accentColor}
                    sparklineValues={metric.sparklineValues}
                    width={metricWidth}
                  />
                ))}
              </View>

              <View style={[styles.analyticsRow, isWide ? styles.analyticsRowWide : null]}>
                <RevenueBarChart data={hourlyRevenue} />
                <StockAlertsPanel alerts={stockAlerts} topItems={topItems} />
              </View>

              <ActiveOrdersPanel orders={activeOrders} onViewAll={() => navigation.navigate('Don Hang')} />

              <ModuleLauncherGrid
                modules={MODULES}
                columns={moduleColumns}
                onNavigate={(routeName: AdminModuleRoute) => navigation.navigate(routeName)}
              />
            </>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    backgroundColor: '#080D14',
  },
  screenScroll: {
    flex: 1,
  },
  screenContent: {
    padding: 16,
    paddingBottom: 34,
  },
  screenContentWide: {
    paddingHorizontal: 28,
    paddingTop: 24,
  },
  stack: {
    width: '100%',
    maxWidth: 1280,
    alignSelf: 'center',
    rowGap: 18,
  },
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    color: '#F8FAFC',
    fontSize: 28,
    fontWeight: '900',
  },
  subtitle: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 4,
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
  },
  analyticsRow: {
    flexDirection: 'column',
    rowGap: 14,
  },
  analyticsRowWide: {
    flexDirection: 'row',
    columnGap: 14,
  },
});
