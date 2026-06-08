import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export type AdminModuleRoute = 'Don Hang' | 'Nhan Su' | 'Kho' | 'Menu' | 'Ban' | 'Cham Cong' | 'Bang Luong';

export type AdminModuleCard = {
  key: string;
  label: string;
  routeName?: AdminModuleRoute;
};

type ModuleLauncherGridProps = {
  modules: AdminModuleCard[];
  columns: number;
  onNavigate: (routeName: AdminModuleRoute) => void;
};

export function ModuleLauncherGrid({ modules, columns, onNavigate }: ModuleLauncherGridProps) {
  const gap = 12;
  const cardWidth = `${100 / columns}%` as `${number}%`;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>Module quản lý</Text>
        <Text style={styles.subtitle}>{modules.length} module</Text>
      </View>
      <View style={[styles.grid, { marginHorizontal: -gap / 2 }]}>
        {modules.map((moduleCard) => {
          const disabled = !moduleCard.routeName;
          return (
            <View key={moduleCard.key} style={{ width: cardWidth, paddingHorizontal: gap / 2, marginBottom: gap }}>
              <TouchableOpacity
                activeOpacity={disabled ? 1 : 0.82}
                disabled={disabled}
                style={[styles.moduleCard, disabled ? styles.moduleDisabled : null]}
                onPress={() => {
                  if (moduleCard.routeName) {
                    onNavigate(moduleCard.routeName);
                  }
                }}
              >
                <View style={styles.moduleIcon}>
                  <Text style={styles.moduleIconText}>{moduleCard.label.slice(0, 1).toUpperCase()}</Text>
                </View>
                <Text style={styles.moduleLabel}>{moduleCard.label}</Text>
                <Text style={styles.moduleMeta}>{disabled ? 'Chưa triển khai' : 'Mở module'}</Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    padding: 18,
    backgroundColor: 'rgba(15,23,42,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(99,102,241,0.18)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  title: {
    color: '#E2E8F0',
    fontSize: 16,
    fontWeight: '800',
  },
  subtitle: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '700',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  moduleCard: {
    minHeight: 118,
    borderRadius: 18,
    padding: 14,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1E293B',
    rowGap: 8,
  },
  moduleDisabled: {
    opacity: 0.62,
  },
  moduleIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(99,102,241,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(99,102,241,0.26)',
  },
  moduleIconText: {
    color: '#A5B4FC',
    fontWeight: '900',
  },
  moduleLabel: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '800',
  },
  moduleMeta: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '700',
  },
});
