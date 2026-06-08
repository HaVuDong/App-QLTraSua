import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Coffee, LogOut } from 'lucide-react-native';
import { styles } from '../styles/appStyles';
import { COLORS, SIZES } from '../theme';
import type { SessionUser } from '../types/auth';
import { getRoleLabel, getRouteMeta, getUserInitial, renderTabIcon } from './navigationMeta';

export function AdminHeaderTitle({ compact, routeName }: { compact: boolean; routeName: string }) {
  const meta = getRouteMeta(routeName);

  return (
    <View style={styles.headerTitleWrap}>
      {!compact ? <Text style={styles.headerEyebrow}>Trà Sữa Order</Text> : null}
      <Text style={styles.headerMainTitle} numberOfLines={1}>
        {meta.label}
      </Text>
      {!compact ? (
        <Text style={styles.headerSubtitle} numberOfLines={1}>
          {meta.subtitle}
        </Text>
      ) : null}
    </View>
  );
}

export function AdminHeaderRight({
  compact,
  onLogout,
  socketReady,
  user,
}: {
  compact: boolean;
  onLogout: () => void;
  socketReady: boolean;
  user: SessionUser | null;
}) {
  return (
    <View style={styles.headerActions}>
      {!compact ? (
        <View style={styles.headerStatusPill}>
          <View style={[styles.headerStatusDot, socketReady ? styles.headerStatusDotOnline : styles.headerStatusDotOffline]} />
          <Text style={styles.headerStatusText}>{socketReady ? 'Đang kết nối' : 'Ngoại tuyến'}</Text>
        </View>
      ) : null}

      {!compact ? (
        <View style={styles.headerUserPill}>
          <View style={styles.headerAvatar}>
            <Text style={styles.headerAvatarText}>{getUserInitial(user)}</Text>
          </View>
          <View style={styles.headerUserTextWrap}>
            <Text style={styles.headerUserRole} numberOfLines={1}>
              {getRoleLabel(user?.role)}
            </Text>
            <Text style={styles.headerUserEmail} numberOfLines={1}>
              {user?.email || user?.phone || 'Đang đăng nhập'}
            </Text>
          </View>
        </View>
      ) : null}

      <TouchableOpacity activeOpacity={0.84} onPress={onLogout} style={styles.headerLogoutButton}>
        <LogOut color={COLORS.secondaryLight} size={SIZES.iconMd} />
        {!compact ? <Text style={styles.headerLogoutText}>Đăng xuất</Text> : null}
      </TouchableOpacity>
    </View>
  );
}

export function AdminSidebarTabBar({ descriptors, navigation, onLogout, socketReady, state, user }: any) {
  return (
    <View style={styles.sidebarShell}>
      <View style={styles.sidebarBrand}>
        <View style={styles.sidebarLogo}>
          <Coffee color={COLORS.background} size={SIZES.iconLg} />
        </View>
        <View style={styles.sidebarBrandText}>
          <Text style={styles.sidebarBrandTitle}>TRÀ SỮA POS</Text>
          <Text style={styles.sidebarBrandSubtitle}>Không gian Admin</Text>
        </View>
      </View>

      <View style={styles.sidebarStoreCard}>
        <Text style={styles.sidebarStoreLabel}>Không gian làm việc</Text>
        <Text style={styles.sidebarStoreName} numberOfLines={1}>
          {user?.tenantId ? 'Cửa hàng hiện tại' : 'Trà Sữa Order'}
        </Text>
        <View style={styles.sidebarStatusRow}>
          <View style={[styles.sidebarStatusDot, socketReady ? styles.headerStatusDotOnline : styles.headerStatusDotOffline]} />
          <Text style={styles.sidebarStatusText}>{socketReady ? 'Realtime đã sẵn sàng' : 'Đang chờ kết nối'}</Text>
        </View>
      </View>

      <Text style={styles.sidebarSectionLabel}>Điều hướng</Text>
      <ScrollView
        style={styles.sidebarScroll}
        contentContainerStyle={styles.sidebarScrollContent}
        showsVerticalScrollIndicator={false}
      >
        {state.routes.map((route: any, index: number) => {
          const focused = state.index === index;
          const options = descriptors[route.key]?.options || {};
          const meta = getRouteMeta(route.name);
          const labelOption = options.tabBarLabel ?? options.title ?? meta.label;
          const label = typeof labelOption === 'string' ? labelOption : meta.label;
          const iconColor = focused ? COLORS.primaryLight : COLORS.textMuted;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          const onLongPress = () => {
            navigation.emit({
              type: 'tabLongPress',
              target: route.key,
            });
          };

          return (
            <TouchableOpacity
              key={route.key}
              accessibilityRole="button"
              accessibilityState={focused ? { selected: true } : {}}
              activeOpacity={0.86}
              onLongPress={onLongPress}
              onPress={onPress}
              style={[styles.sidebarItem, focused ? styles.sidebarItemActive : null]}
            >
              {focused ? <View style={styles.sidebarActiveRail} /> : null}
              <View style={[styles.sidebarIconBox, focused ? styles.sidebarIconBoxActive : null]}>
                {renderTabIcon(route.name, iconColor, SIZES.iconMd)}
              </View>
              <View style={styles.sidebarItemCopy}>
                <Text style={[styles.sidebarItemLabel, focused ? styles.sidebarItemLabelActive : null]} numberOfLines={1}>
                  {label}
                </Text>
                <Text style={styles.sidebarItemSubtitle} numberOfLines={1}>
                  {meta.subtitle}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

    </View>
  );
}
