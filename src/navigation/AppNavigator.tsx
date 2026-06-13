import { useWindowDimensions, TouchableOpacity, View } from 'react-native';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { BottomTabBar, createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LogOut } from 'lucide-react-native';
import { useAuth } from '../auth/AuthContext';
import { RestrictedStateView, LoadingView } from '../components/StateViews';
import { ScreenBackdrop } from '../components/common/ScreenBackdrop';
import AdminDashboardScreen from '../screens/admin/AdminDashboardScreen';
import { AuthScreen } from '../screens/auth/AuthScreen';
import { ChangePasswordScreen } from '../screens/auth/ChangePasswordScreen';
import { AttendanceManagementScreen } from '../screens/attendance/AttendanceManagementScreen';
import { InventoryScreen } from '../screens/inventory/InventoryScreen';
import { MenuManagementScreen } from '../screens/menu/MenuManagementScreen';
import { KitchenScreen } from '../screens/orders/KitchenScreen';
import { OrderScreen as StaffOrderScreen } from '../screens/orders/OrderScreen';
import { PayrollManagementScreen } from '../screens/payroll/PayrollManagementScreen';
import { ShiftScreen } from '../screens/shifts/ShiftScreen';
import { StaffManagementScreen } from '../screens/staff/StaffManagementScreen';
import { SystemOwnerScreen } from '../screens/system-owner/SystemOwnerScreen';
import { TableManagementScreen } from '../screens/tables/TableManagementScreen';
import { styles } from '../styles/appStyles';
import { COLORS, SIZES } from '../theme';
import { AdminHeaderRight, AdminHeaderTitle, AdminSidebarTabBar } from './AdminShell';
import { getInitialTabRouteForRole, getRouteMeta, getTabScreensForRole, isAdminDashboardRole, renderTabIcon } from './navigationMeta';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

export function AppNavigator() {
  const { width } = useWindowDimensions();
  const { token, user, requiresPasswordChange, socketReady, handleLogout } = useAuth();

  const tabRoleState = user ? getTabScreensForRole(user.role) : null;
  const hasAnyTab = Boolean(
    tabRoleState && (
      tabRoleState.showShift ||
      tabRoleState.showOrders ||
      tabRoleState.showStaffWorkspace ||
      tabRoleState.showKitchenQueue ||
      tabRoleState.showManagement
    ),
  );
  const initialTabRoute = user ? getInitialTabRouteForRole(user.role) : undefined;
  const isAdminTabFlow = user ? isAdminDashboardRole(user.role) : false;
  const useSideTabs = width >= 900;

  return (
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
          <Stack.Screen name="Quản Trị SaaS" component={SystemOwnerScreen} />
        </Stack.Navigator>
      ) : !hasAnyTab ? (
        <View style={styles.screenContainer}>
          <ScreenBackdrop />
          <RestrictedStateView message="Tài khoản của bạn không có màn hình quản trị hợp lệ." actionText="Đăng xuất" onAction={() => void handleLogout()} />
        </View>
      ) : (
        <Tab.Navigator
          initialRouteName={initialTabRoute}
          tabBar={(props) =>
            useSideTabs ? (
              <AdminSidebarTabBar {...props} onLogout={() => void handleLogout()} socketReady={socketReady} user={user} />
            ) : (
              <BottomTabBar {...props} />
            )
          }
          screenOptions={({ route }) => ({
            title: getRouteMeta(route.name).label,
            headerStyle: [styles.header, useSideTabs ? styles.headerWide : null] as any,
            headerTintColor: COLORS.text,
            headerTitleStyle: styles.headerTitle as any,
            headerTitle: () => <AdminHeaderTitle compact={!useSideTabs} routeName={route.name} />,
            headerRight: () => (
              <AdminHeaderRight compact={!useSideTabs} onLogout={() => void handleLogout()} socketReady={socketReady} user={user} />
            ),
            tabBarActiveTintColor: COLORS.primaryLight,
            tabBarInactiveTintColor: COLORS.textMuted,
            tabBarPosition: useSideTabs ? 'left' : 'bottom',
            tabBarLabelPosition: useSideTabs ? 'beside-icon' : 'below-icon',
            tabBarLabel: getRouteMeta(route.name).label,
            tabBarStyle: [styles.tabBar, useSideTabs ? styles.tabBarSide : null] as any,
            tabBarLabelStyle: styles.tabBarLabel,
            tabBarIcon: ({ color, size }) => renderTabIcon(route.name, color, size),
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
              {tabRoleState?.showStaffWorkspace ? <Tab.Screen name="Don Hang" component={StaffOrderScreen} /> : null}
              {tabRoleState?.showKitchenQueue ? <Tab.Screen name="Bep" component={KitchenScreen} /> : null}
            </>
          ) : (
            <>
              {tabRoleState?.showShift ? <Tab.Screen name="Ca Lam" component={ShiftScreen} /> : null}
              {tabRoleState?.showStaffWorkspace ? <Tab.Screen name="Phuc Vu" component={StaffOrderScreen} /> : null}
              {tabRoleState?.showKitchenQueue ? <Tab.Screen name="Bep" component={KitchenScreen} /> : null}
            </>
          )}
        </Tab.Navigator>
      )}
    </NavigationContainer>
  );
}
