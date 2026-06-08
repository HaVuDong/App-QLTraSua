import { StyleSheet, Text, View } from 'react-native';
import type { SessionUser } from '../../../types/auth';

type AdminTopBarProps = {
  user: SessionUser;
  isWide: boolean;
};

export function AdminTopBar({ user, isWide }: AdminTopBarProps) {
  const now = new Date();
  const timeLabel = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  const dateLabel = now.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
  const initial = (user.email || user.phone || user.role || 'A').slice(0, 1).toUpperCase();

  return (
    <View style={[styles.container, isWide ? styles.containerWide : null]}>
      <View style={styles.brandRow}>
        <View style={styles.logo}>
          <Text style={styles.logoText}>T</Text>
        </View>
        <View>
          <Text style={styles.brand}>Trà Sữa Admin</Text>
          <Text style={styles.liveText}>Bảng điều khiển trực tiếp</Text>
        </View>
      </View>

      <View style={styles.profileRow}>
        {isWide ? (
          <View style={styles.timeBox}>
            <Text style={styles.timeText}>{timeLabel}</Text>
            <Text style={styles.dateText}>{dateLabel}</Text>
          </View>
        ) : null}
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: 14,
    padding: 16,
    borderRadius: 22,
    backgroundColor: '#090E18',
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  containerWide: {
    paddingHorizontal: 20,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 12,
    minWidth: 0,
    flex: 1,
  },
  logo: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6366F1',
  },
  logoText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
  },
  brand: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '800',
  },
  liveText: {
    color: '#34D399',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 12,
  },
  timeBox: {
    alignItems: 'flex-end',
  },
  timeText: {
    color: '#E2E8F0',
    fontSize: 14,
    fontWeight: '800',
  },
  dateText: {
    color: '#64748B',
    fontSize: 10,
    marginTop: 2,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4F46E5',
  },
  avatarText: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
});
