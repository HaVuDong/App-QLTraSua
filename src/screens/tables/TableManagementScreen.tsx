import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, RefreshControl, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useAuth } from '../../auth/AuthContext';
import { ScreenBackdrop } from '../../components/common/ScreenBackdrop';
import { runConfirmedAction } from '../../components/common/ConfirmAction';
import { EmptyStateView, ErrorStateView, LoadingView, RestrictedStateView } from '../../components/StateViews';
import { CUSTOMER_APP_BASE_URL } from '../../config/api';
import { MANAGEMENT_ROLES } from '../../constants/roles';
import { api } from '../../services/api';
import { getActiveOrders } from '../../services/order';
import { createTable, deleteTable, getTables, resetTableQr, toggleTableVisibility, updateTable, updateTableStatus, type DiningTable } from '../../services/table';
import { styles } from '../../styles/appStyles';
import { COLORS } from '../../theme';

type TableViewStatus = 'AVAILABLE' | 'ACTIVE' | 'DISABLED';
function getTableViewStatus(table: DiningTable): TableViewStatus {
  if (table.isHidden) return 'DISABLED';
  if (table.status === 'EMPTY') return 'AVAILABLE';
  return 'ACTIVE';
}

function getTableViewStatusLabel(viewStatus: TableViewStatus) {
  if (viewStatus === 'AVAILABLE') return 'Còn trống';
  if (viewStatus === 'ACTIVE') return 'Đang hoạt động';
  return 'Tạm ngưng';
}

function getTableFilterLabel(filter: TableViewStatus | 'ALL') {
  if (filter === 'ALL') return 'Tất cả';
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
  return `Bàn ${tableNumber.trim()}`;
}

function normalizeQrUrl(rawQrUrl?: string) {
  const trimmed = rawQrUrl?.trim() || '';
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `${CUSTOMER_APP_BASE_URL}${trimmed.startsWith('/') ? '' : '/'}${trimmed}`;
}

function isValidHttpUrl(value: string) {
  return /^https?:\/\/\S+$/i.test(value.trim());
}

function getDiningTableNumber(table: DiningTable) {
  const persistedNumber = table.tableNumber?.trim();
  if (persistedNumber) return persistedNumber;
  return parseTableName(table.name || '').tableNumber;
}

function buildCustomerQrUrl(table: DiningTable | null, tenantId?: string | null) {
  if (!table) return '';
  const backendQrUrl = normalizeQrUrl(table.qrUrl);
  if (backendQrUrl) return backendQrUrl;

  const tenant = tenantId?.trim() || '';
  const qrToken = table.qrCodeToken?.trim() || '';
  if (!tenant || !qrToken) return '';

  return `${CUSTOMER_APP_BASE_URL}/table/${encodeURIComponent(tenant)}/${encodeURIComponent(qrToken)}`;
}

export function TableManagementScreen() {
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
  const canUseAdminTableActions = user?.role === 'ADMIN';
  const adminOnlyTableActionMessage = 'Chỉ ADMIN mới có quyền thực hiện thao tác này';

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
      setLoadError(err.response?.data?.message || 'Không thể tải danh sách bàn');
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
    setFormTableNumber(getDiningTableNumber(table));
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
      setFormError('Số bàn là bắt buộc');
      return;
    }
    if (!/^\d+$/.test(tableNumber)) {
      setFormError('Số bàn phải là số hợp lệ');
      return;
    }

    const duplicateTable = tables.find((table) => {
      if (editingTable && table._id === editingTable._id) return false;
      return getDiningTableNumber(table) === tableNumber;
    });
    if (duplicateTable) {
      setFormError('Số bàn đã tồn tại');
      return;
    }

    const tableName = buildTableName(tableNumber, formDisplayName);
    const capacityNum = formCapacity.trim() ? Number(formCapacity) : undefined;

    if (capacityNum !== undefined && (!Number.isFinite(capacityNum) || capacityNum <= 0)) {
      setFormError('Sức chứa phải là số dương');
      return;
    }

    const currentViewStatus = editingTable ? getTableViewStatus(editingTable) : null;
    const requiresVisibilityToggle =
      formMode === 'create'
        ? formStatus === 'DISABLED'
        : formMode === 'edit' && editingTable
          ? currentViewStatus !== formStatus && ((formStatus === 'DISABLED' && !editingTable.isHidden) || (formStatus !== 'DISABLED' && editingTable.isHidden))
          : false;

    if (requiresVisibilityToggle && !canUseAdminTableActions) {
      setFormError(adminOnlyTableActionMessage);
      return;
    }

    setFormSubmitting(true);
    setFormError('');
    try {
      const payload = {
        tableNumber,
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
      setFormError(err.response?.data?.message || 'Không thể lưu thông tin bàn');
    } finally {
      setFormSubmitting(false);
    }
  }, [
    adminOnlyTableActionMessage,
    canUseAdminTableActions,
    editingTable,
    fetchTableData,
    formCapacity,
    formDisplayName,
    formLocation,
    formMode,
    formStatus,
    formTableNumber,
    resetForm,
    tables,
  ]);

  const confirmDeleteTable = useCallback((table: DiningTable) => {
    if (!canUseAdminTableActions) {
      Alert.alert('Không đủ quyền', adminOnlyTableActionMessage);
      return;
    }

    runConfirmedAction({
      title: 'Xóa bàn',
      message: `Bạn chắc chắn muốn xóa ${table.name}?`,
      confirmText: 'Xóa bàn',
      destructive: true,
      onConfirm: async () => {
        try {
          await deleteTable(table._id);
          void fetchTableData(true);
        } catch (err: any) {
          Alert.alert('Không thể xóa bàn', err.response?.data?.message || 'Xóa bàn thất bại');
        }
      },
    });
  }, [adminOnlyTableActionMessage, canUseAdminTableActions, fetchTableData]);

  const resetQrToken = useCallback((table: DiningTable) => {
    if (!canUseAdminTableActions) {
      Alert.alert('Không đủ quyền', adminOnlyTableActionMessage);
      return;
    }

    runConfirmedAction({
      title: 'Tạo lại QR',
      message: `Bạn muốn tạo lại QR cho ${table.name}?`,
      confirmText: 'Tạo lại',
      onConfirm: async () => {
        try {
          const updated = await resetTableQr(table._id);
          setTables((currentTables) => currentTables.map((currentTable) => (currentTable._id === updated._id ? updated : currentTable)));
          if (qrViewTable && qrViewTable._id === table._id) {
            setQrViewTable(updated);
          }
          void fetchTableData(true);
        } catch (err: any) {
          Alert.alert('Lỗi', err.response?.data?.message || 'Không thể tạo lại QR');
        }
      },
    });
  }, [adminOnlyTableActionMessage, canUseAdminTableActions, fetchTableData, qrViewTable]);

  const toggleVisibility = useCallback((table: DiningTable) => {
    if (!canUseAdminTableActions) {
      Alert.alert('Không đủ quyền', adminOnlyTableActionMessage);
      return;
    }

    const willDisable = !table.isHidden;
    runConfirmedAction({
      title: willDisable ? 'Tạm ngưng bàn' : 'Mở lại bàn',
      message: willDisable ? `Bạn muốn tạm ngưng ${table.name}?` : `Bạn muốn mở lại ${table.name}?`,
      confirmText: 'Xác nhận',
      onConfirm: async () => {
        try {
          await toggleTableVisibility(table._id);
          void fetchTableData(true);
        } catch (err: any) {
          Alert.alert('Lỗi', err.response?.data?.message || 'Không thể cập nhật trạng thái bàn');
        }
      },
    });
  }, [adminOnlyTableActionMessage, canUseAdminTableActions, fetchTableData]);

  if (!user || !MANAGEMENT_ROLES.includes(user.role)) {
    return (
      <View style={styles.screenContainer}>
        <ScreenBackdrop />
        <RestrictedStateView message="Bạn không có quyền truy cập màn hình bàn." />
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
    const searchableText = `${table.name} ${getDiningTableNumber(table)}`.toLowerCase();
    if (keyword && !searchableText.includes(keyword)) {
      return false;
    }
    return true;
  });

  const totalAvailable = tables.filter((table) => getTableViewStatus(table) === 'AVAILABLE').length;
  const totalActive = tables.filter((table) => getTableViewStatus(table) === 'ACTIVE').length;
  const totalDisabled = tables.filter((table) => getTableViewStatus(table) === 'DISABLED').length;

  const qrInfoToken = qrViewTable?.qrCodeToken || '';
  const qrPreviewUrl = buildCustomerQrUrl(qrViewTable, user.tenantId);
  const canRenderQrPreview = isValidHttpUrl(qrPreviewUrl);
  const qrPreviewTableNumber = qrViewTable ? getDiningTableNumber(qrViewTable) : '';
  const qrPreviewStoreName = 'TRÀ SỮA POS';

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
          <Text style={styles.sectionTitle}>Quản lý bàn</Text>

          <View style={styles.metricGrid}>
            <View style={[styles.glassCard, styles.metricCard]}>
              <Text style={styles.metricLabel}>Còn trống</Text>
              <Text style={styles.metricValue}>{totalAvailable}</Text>
            </View>
            <View style={[styles.glassCard, styles.metricCard]}>
              <Text style={styles.metricLabel}>Đang hoạt động</Text>
              <Text style={styles.metricValue}>{totalActive}</Text>
            </View>
            <View style={[styles.glassCard, styles.metricCard]}>
              <Text style={styles.metricLabel}>Tạm ngưng</Text>
              <Text style={styles.metricValue}>{totalDisabled}</Text>
            </View>
          </View>

          <View style={[styles.glassCard, styles.inventoryToolbar]}>
            <TextInput
              placeholder="Tìm theo số bàn/tên bàn"
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
              <Text style={styles.buttonText}>Thêm bàn</Text>
            </TouchableOpacity>
            {!canUseAdminTableActions ? <Text style={styles.helperText}>{adminOnlyTableActionMessage}</Text> : null}
          </View>

          {formMode ? (
            <View style={[styles.glassCard, styles.formCard]}>
              <Text style={styles.sectionTitle}>{formMode === 'create' ? 'Thêm bàn' : 'Sửa bàn'}</Text>
              {formError ? <Text style={styles.errorText}>{formError}</Text> : null}

              <TextInput
                placeholder="Số bàn (bắt buộc)"
                value={formTableNumber}
                onChangeText={setFormTableNumber}
                keyboardType="number-pad"
                placeholderTextColor={COLORS.textMuted}
                style={styles.input}
              />
              <TextInput
                placeholder="Tên hiển thị (tùy chọn)"
                value={formDisplayName}
                onChangeText={setFormDisplayName}
                placeholderTextColor={COLORS.textMuted}
                style={styles.input}
              />
              <TextInput
                placeholder="Sức chứa (tùy chọn)"
                value={formCapacity}
                onChangeText={setFormCapacity}
                keyboardType="number-pad"
                placeholderTextColor={COLORS.textMuted}
                style={styles.input}
              />
              <TextInput
                placeholder="Khu vực (tùy chọn)"
                value={formLocation}
                onChangeText={setFormLocation}
                placeholderTextColor={COLORS.textMuted}
                style={styles.input}
              />

              <Text style={styles.helperText}>Trạng thái bàn</Text>
              {!canUseAdminTableActions ? <Text style={styles.helperText}>{adminOnlyTableActionMessage}</Text> : null}
              <View style={styles.filterRow}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  disabled={!canUseAdminTableActions && Boolean(formMode === 'edit' && editingTable?.isHidden)}
                  style={[
                    styles.filterChip,
                    formStatus === 'AVAILABLE' ? styles.filterChipActive : null,
                    !canUseAdminTableActions && Boolean(formMode === 'edit' && editingTable?.isHidden) ? styles.moduleCardDisabled : null,
                  ]}
                  onPress={() => setFormStatus('AVAILABLE')}
                >
                  <Text style={[styles.filterChipText, formStatus === 'AVAILABLE' ? styles.filterChipTextActive : null]}>Còn trống</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.8}
                  disabled={!canUseAdminTableActions && Boolean(formMode === 'edit' && editingTable?.isHidden)}
                  style={[
                    styles.filterChip,
                    formStatus === 'ACTIVE' ? styles.filterChipActive : null,
                    !canUseAdminTableActions && Boolean(formMode === 'edit' && editingTable?.isHidden) ? styles.moduleCardDisabled : null,
                  ]}
                  onPress={() => setFormStatus('ACTIVE')}
                >
                  <Text style={[styles.filterChipText, formStatus === 'ACTIVE' ? styles.filterChipTextActive : null]}>Đang hoạt động</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.8}
                  disabled={!canUseAdminTableActions}
                  style={[styles.filterChip, formStatus === 'DISABLED' ? styles.filterChipActive : null, !canUseAdminTableActions ? styles.moduleCardDisabled : null]}
                  onPress={() => setFormStatus('DISABLED')}
                >
                  <Text style={[styles.filterChipText, formStatus === 'DISABLED' ? styles.filterChipTextActive : null]}>Tạm ngưng</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.rowSplit}>
                <TouchableOpacity activeOpacity={0.8} style={[styles.buttonBase, styles.buttonSecondary, styles.flex1]} onPress={resetForm}>
                  <Text style={styles.buttonText}>Hủy</Text>
                </TouchableOpacity>
                <TouchableOpacity activeOpacity={0.8} style={[styles.buttonBase, styles.buttonPrimary, styles.flex1]} onPress={() => void saveTableForm()}>
                  {formSubmitting ? <ActivityIndicator color={COLORS.text} /> : <Text style={styles.buttonText}>Lưu bàn</Text>}
                </TouchableOpacity>
              </View>
            </View>
          ) : null}

          {loadError ? <ErrorStateView message={loadError} onRetry={() => void fetchTableData()} /> : null}

          {!loadError && filteredTables.length === 0 ? (
            <EmptyStateView message="Chưa có bàn nào." />
          ) : (
            filteredTables.map((table) => {
              const viewStatus = getTableViewStatus(table);
              const statusStyle = viewStatus === 'DISABLED' ? styles.statusPending : viewStatus === 'ACTIVE' ? styles.statusLowStock : styles.statusProgress;
              const activeOrders = activeOrderCountByTable[table._id] || 0;
              const tableNumber = getDiningTableNumber(table);

              return (
                <View key={table._id} style={[styles.glassCard, styles.inventoryItemCard]}>
                  <View style={styles.staffHeader}>
                    <View style={styles.staffInfo}>
                      <Text style={styles.staffName}>{table.name}</Text>
                      <Text style={styles.staffMeta}>Số bàn: {tableNumber || 'Không xác định'}</Text>
                      <Text style={styles.staffMeta}>Sức chứa: {table.capacity || '-'}</Text>
                      <Text style={styles.staffMeta}>QR: {table.qrCodeToken ? 'Sẵn sàng' : 'Máy chủ chưa hỗ trợ QR cho bàn'}</Text>
                      <Text style={styles.staffMeta}>Đơn đang mở: {activeOrders}</Text>
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
                      <Text style={styles.buttonText}>Sửa bàn</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      activeOpacity={canUseAdminTableActions ? 0.8 : 1}
                      disabled={!canUseAdminTableActions}
                      style={[styles.buttonBase, styles.buttonAmber, styles.flex1, !canUseAdminTableActions ? styles.moduleCardDisabled : null]}
                      onPress={() => confirmDeleteTable(table)}
                    >
                      <Text style={styles.buttonText}>Xóa bàn</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.inventoryActionRow}>
                    {canUseAdminTableActions ? (
                      <TouchableOpacity activeOpacity={0.8} style={[styles.buttonBase, styles.buttonPrimary, styles.flex1]} onPress={() => resetQrToken(table)}>
                        <Text style={styles.buttonText}>Tạo lại QR</Text>
                      </TouchableOpacity>
                    ) : null}
                    <TouchableOpacity
                      activeOpacity={canUseAdminTableActions ? 0.8 : 1}
                      disabled={!canUseAdminTableActions}
                      style={[styles.buttonBase, styles.buttonSecondary, styles.flex1, !canUseAdminTableActions ? styles.moduleCardDisabled : null]}
                      onPress={() => toggleVisibility(table)}
                    >
                      <Text style={styles.buttonText}>{table.isHidden ? 'Mở lại bàn' : 'Tạm ngưng bàn'}</Text>
                    </TouchableOpacity>
                  </View>
                  {!canUseAdminTableActions ? <Text style={styles.helperText}>{adminOnlyTableActionMessage}</Text> : null}
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      <Modal transparent visible={Boolean(qrViewTable)} animationType="fade" onRequestClose={() => setQrViewTable(null)}>
        <View style={styles.qrModalOverlay}>
          <View style={[styles.glassCard, styles.qrModalCard]}>
            {qrViewTable ? (
              <>
                <Text style={styles.sectionTitle}>Mã QR của bàn</Text>
                <Text style={styles.qrStoreName}>{qrPreviewStoreName}</Text>
                <Text style={styles.qrTableNumber}>Bàn số {qrPreviewTableNumber || 'Không xác định'}</Text>

                <View style={styles.qrCodeFrame}>
                  {canRenderQrPreview ? (
                    <QRCode value={qrPreviewUrl} size={200} color={COLORS.background} backgroundColor="#FFFFFF" quietZone={8} ecl="M" />
                  ) : (
                    <Text style={styles.helperText}>Không thể hiển thị QR</Text>
                  )}
                </View>

                <Text style={styles.qrInstruction}>Quét mã để gọi món</Text>
                <Text style={styles.qrMetaLabel}>Đường dẫn QR</Text>
                <Text selectable style={styles.qrUrlText}>{canRenderQrPreview ? qrPreviewUrl : '-'}</Text>
                <Text style={styles.qrMetaLabel}>QR Token</Text>
                <Text selectable style={styles.qrUrlText}>{qrInfoToken || '-'}</Text>

                <TouchableOpacity activeOpacity={1} disabled style={[styles.buttonBase, styles.buttonSecondary, styles.moduleCardDisabled]}>
                  <Text style={styles.buttonText}>In QR</Text>
                </TouchableOpacity>
                <Text style={styles.helperText}>Chưa tích hợp máy in QR</Text>

                <View style={styles.rowSplit}>
                  <TouchableOpacity activeOpacity={0.8} style={[styles.buttonBase, styles.buttonSecondary, styles.flex1]} onPress={() => setQrViewTable(null)}>
                    <Text style={styles.buttonText}>Đóng</Text>
                  </TouchableOpacity>
                  {canUseAdminTableActions ? (
                    <TouchableOpacity activeOpacity={0.8} style={[styles.buttonBase, styles.buttonPrimary, styles.flex1]} onPress={() => resetQrToken(qrViewTable)}>
                      <Text style={styles.buttonText}>Tạo lại QR</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
                {!canUseAdminTableActions ? <Text style={styles.helperText}>{adminOnlyTableActionMessage}</Text> : null}
              </>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}
