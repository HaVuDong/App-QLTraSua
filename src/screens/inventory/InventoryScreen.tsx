import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../../auth/AuthContext';
import { ScreenBackdrop } from '../../components/common/ScreenBackdrop';
import { runConfirmedAction } from '../../components/common/ConfirmAction';
import { EmptyStateView, ErrorStateView, LoadingView, RestrictedStateView } from '../../components/StateViews';
import { MANAGEMENT_ROLES } from '../../constants/roles';
import { createInventoryItem, deleteInventoryItem, getInventoryItems, getInventoryStatusSummary, updateInventoryItem, type InventoryCategory, type InventoryItem } from '../../services/inventory';
import { styles } from '../../styles/appStyles';
import { COLORS } from '../../theme';
import { formatCurrencyVnd } from '../../utils/format';
import { getInventoryCategoryLabel, getInventoryFilterLabel, getInventoryStockStatus, type InventoryFilterStatus } from '../../utils/displayLabels';
import { parseOptionalNumberInput } from '../../utils/recipeMath';

type InventoryStockAction = 'INCREASE' | 'DECREASE';

const INVENTORY_CATEGORY_OPTIONS: InventoryCategory[] = ['DRINK', 'FOOD', 'FRUIT', 'OTHER'];
const INVENTORY_FILTER_OPTIONS: InventoryFilterStatus[] = ['ALL', 'AVAILABLE', 'LOW_STOCK', 'OUT_OF_STOCK'];
const INVENTORY_ADJUST_REASONS = ['nhập hàng', 'hủy hàng', 'kiểm kho', 'hao hụt', 'điều chỉnh thủ công'] as const;
export function InventoryScreen() {
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
  const [formCostPrice, setFormCostPrice] = useState('');
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
      setLoadError(err.response?.data?.message || 'Không thể tải dữ liệu kho');
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
    setFormCostPrice('');
    setFormError('');
  }, []);

  const openCreateForm = useCallback(() => {
    setFormMode('create');
    setEditingItemId('');
    setFormName('');
    setFormCategory('DRINK');
    setFormUnit('');
    setFormStock('');
    setFormThreshold('');
    setFormCostPrice('');
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
    setFormCostPrice(String(Number(((item.costPrice || 0) * (item.stock || 0)).toFixed(4))));
    setFormError('');
    setAdjustingItem(null);
  }, []);

  const saveForm = useCallback(async () => {
    const normalizedName = formName.trim();
    const normalizedUnit = formUnit.trim();
    const stockValue = parseOptionalNumberInput(formStock);
    const thresholdValue = parseOptionalNumberInput(formThreshold);
    const costPriceValue = parseOptionalNumberInput(formCostPrice);

    if (!normalizedName) {
      setFormError('Tên nguyên liệu là bắt buộc');
      return;
    }
    if (!normalizedUnit) {
      setFormError('Đơn vị tính là bắt buộc');
      return;
    }
    if (!Number.isFinite(stockValue) || stockValue < 0) {
      setFormError('Số lượng tồn kho phải là số không âm');
      return;
    }
    if (!Number.isFinite(thresholdValue) || thresholdValue < 0) {
      setFormError('Ngưỡng tồn tối thiểu phải là số không âm');
      return;
    }
    if (!Number.isFinite(costPriceValue) || costPriceValue < 0) {
      setFormError('Giá vốn phải là số không âm');
      return;
    }
    if (costPriceValue > 0 && stockValue <= 0) {
      setFormError('Cần nhập tồn kho lớn hơn 0 để tính giá vốn mỗi đơn vị');
      return;
    }
    setFormSubmitting(true);
    setFormError('');
    try {
      const unitCostPrice = stockValue > 0 ? Number((costPriceValue / stockValue).toFixed(4)) : 0;
      const payload = {
        name: normalizedName,
        category: formCategory,
        unit: normalizedUnit,
        stock: stockValue,
        minStockLevel: thresholdValue,
        costPrice: unitCostPrice,
        sellingPrice: unitCostPrice,
      };

      if (formMode === 'create') {
        await createInventoryItem(payload);
      } else if (formMode === 'edit' && editingItemId) {
        await updateInventoryItem(editingItemId, payload);
      }

      resetForm();
      void fetchInventoryData(true);
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Không thể lưu nguyên liệu');
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
    formStock,
    formThreshold,
    formUnit,
    resetForm,
  ]);

  const confirmDeleteItem = useCallback((item: InventoryItem) => {
    runConfirmedAction({
      title: 'Xóa nguyên liệu',
      message: `Bạn chắc chắn muốn xóa "${item.name}"?`,
      confirmText: 'Xóa',
      destructive: true,
      onConfirm: async () => {
        try {
          await deleteInventoryItem(item._id);
          void fetchInventoryData(true);
        } catch (err: any) {
          Alert.alert('Không thể xóa', err.response?.data?.message || 'Xóa nguyên liệu thất bại');
        }
      },
    });
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
      setAdjustError('Số lượng điều chỉnh phải lớn hơn 0');
      return;
    }
    if (!adjustReason) {
      setAdjustError('Vui lòng chọn lý do điều chỉnh');
      return;
    }

    const nextStock = adjustType === 'INCREASE' ? adjustingItem.stock + amount : adjustingItem.stock - amount;
    if (nextStock < 0) {
      setAdjustError('Không thể giảm tồn kho xuống dưới 0');
      return;
    }

    setAdjustSubmitting(true);
    setAdjustError('');
    try {
      await updateInventoryItem(adjustingItem._id, { stock: nextStock });
      setAdjustingItem(null);
      void fetchInventoryData(true);
      Alert.alert('Thành công', `Đã cập nhật tồn kho. Lý do: ${adjustReason}`);
    } catch (err: any) {
      setAdjustError(err.response?.data?.message || 'Không thể điều chỉnh tồn kho');
    } finally {
      setAdjustSubmitting(false);
    }
  }, [adjustAmount, adjustReason, adjustType, adjustingItem, fetchInventoryData]);

  if (!user || !MANAGEMENT_ROLES.includes(user.role)) {
    return (
      <View style={styles.screenContainer}>
        <ScreenBackdrop />
        <RestrictedStateView message="Bạn không có quyền truy cập màn hình kho." />
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
          <Text style={styles.sectionTitle}>Quản lý kho</Text>

          {statusSummary ? (
            <View style={styles.metricGrid}>
              <View style={[styles.glassCard, styles.metricCard]}>
                <Text style={styles.metricLabel}>Tổng nguyên liệu</Text>
                <Text style={styles.metricValue}>{statusSummary.totalItems ?? items.length}</Text>
              </View>
              <View style={[styles.glassCard, styles.metricCard]}>
                <Text style={styles.metricLabel}>Sắp hết hàng</Text>
                <Text style={styles.metricValue}>{statusSummary.lowStockCount ?? 0}</Text>
              </View>
            </View>
          ) : null}

          <View style={[styles.glassCard, styles.inventoryToolbar]}>
            <TextInput
              placeholder="Tìm theo tên nguyên liệu"
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
                    <Text style={[styles.filterChipText, selected ? styles.filterChipTextActive : null]}>{getInventoryFilterLabel(option)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity activeOpacity={0.8} style={[styles.buttonBase, styles.buttonPrimary]} onPress={openCreateForm}>
              <Text style={styles.buttonText}>Thêm nguyên liệu</Text>
            </TouchableOpacity>
          </View>

          {formMode ? (
            <View style={[styles.glassCard, styles.formCard]}>
              <Text style={styles.sectionTitle}>{formMode === 'create' ? 'Tạo nguyên liệu' : 'Cập nhật nguyên liệu'}</Text>
              {formError ? <Text style={styles.errorText}>{formError}</Text> : null}

              <Text style={styles.fieldLabel}>Tên nguyên liệu</Text>
              <TextInput placeholder="Ví dụ: Trân châu đen" value={formName} onChangeText={setFormName} placeholderTextColor={COLORS.textMuted} style={styles.input} />
              <Text style={styles.fieldLabel}>Đơn vị tính</Text>
              <TextInput
                placeholder="Ví dụ: kg, g, lít, ml"
                value={formUnit}
                onChangeText={setFormUnit}
                placeholderTextColor={COLORS.textMuted}
                style={styles.input}
              />
              <Text style={styles.fieldLabel}>Tồn kho ban đầu</Text>
              <TextInput
                placeholder="Nhập số lượng đang có"
                value={formStock}
                onChangeText={setFormStock}
                keyboardType="decimal-pad"
                placeholderTextColor={COLORS.textMuted}
                style={styles.input}
              />
              <Text style={styles.fieldLabel}>Ngưỡng cảnh báo sắp hết</Text>
              <TextInput
                placeholder="Nhập mức cần cảnh báo"
                value={formThreshold}
                onChangeText={setFormThreshold}
                keyboardType="decimal-pad"
                placeholderTextColor={COLORS.textMuted}
                style={styles.input}
              />
              <Text style={styles.fieldLabel}>Tổng giá vốn của tồn kho</Text>
              <TextInput
                placeholder="Ví dụ: 100000 cho 10kg"
                value={formCostPrice}
                onChangeText={setFormCostPrice}
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
                      <Text style={[styles.filterChipText, selected ? styles.filterChipTextActive : null]}>{getInventoryCategoryLabel(category)}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.rowSplit}>
                <TouchableOpacity activeOpacity={0.8} style={[styles.buttonBase, styles.buttonSecondary, styles.flex1]} onPress={resetForm}>
                  <Text style={styles.buttonText}>Hủy</Text>
                </TouchableOpacity>
                <TouchableOpacity activeOpacity={0.8} style={[styles.buttonBase, styles.buttonPrimary, styles.flex1]} onPress={() => void saveForm()}>
                  {formSubmitting ? <ActivityIndicator color={COLORS.text} /> : <Text style={styles.buttonText}>Lưu</Text>}
                </TouchableOpacity>
              </View>
            </View>
          ) : null}

          {adjustingItem ? (
            <View style={[styles.glassCard, styles.formCard]}>
              <Text style={styles.sectionTitle}>Điều chỉnh tồn kho: {adjustingItem.name}</Text>
              {adjustError ? <Text style={styles.errorText}>{adjustError}</Text> : null}

              <Text style={styles.helperText}>Tồn hiện tại: {adjustingItem.stock} {adjustingItem.unit}</Text>
              <Text style={styles.helperText}>Lưu ý: máy chủ hiện tại không lưu trữ lý do điều chỉnh.</Text>

              <View style={styles.filterRow}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  style={[styles.filterChip, adjustType === 'INCREASE' ? styles.filterChipActive : null]}
                  onPress={() => setAdjustType('INCREASE')}
                >
                  <Text style={[styles.filterChipText, adjustType === 'INCREASE' ? styles.filterChipTextActive : null]}>Tăng</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.8}
                  style={[styles.filterChip, adjustType === 'DECREASE' ? styles.filterChipActive : null]}
                  onPress={() => setAdjustType('DECREASE')}
                >
                  <Text style={[styles.filterChipText, adjustType === 'DECREASE' ? styles.filterChipTextActive : null]}>Giảm</Text>
                </TouchableOpacity>
              </View>

              <TextInput
                placeholder="Số lượng điều chỉnh"
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
                  <Text style={styles.buttonText}>Hủy</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.8}
                  style={[styles.buttonBase, styles.buttonPrimary, styles.flex1]}
                  onPress={() => void applyStockAdjustment()}
                >
                  {adjustSubmitting ? <ActivityIndicator color={COLORS.text} /> : <Text style={styles.buttonText}>Xác nhận</Text>}
                </TouchableOpacity>
              </View>
            </View>
          ) : null}

          {loadError ? <ErrorStateView message={loadError} onRetry={() => void fetchInventoryData()} /> : null}

          {!loadError && filteredItems.length === 0 ? (
            <EmptyStateView message="Không có nguyên liệu nào trong kho." />
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
                      <Text style={styles.staffMeta}>Danh mục: {getInventoryCategoryLabel(item.category)}</Text>
                      <Text style={styles.staffMeta}>
                        Tồn kho: {item.stock} {item.unit}
                      </Text>
                      <Text style={styles.staffMeta}>Ngưỡng: {item.minStockLevel}</Text>
                      <Text style={styles.staffMeta}>Giá vốn đơn vị: {formatCurrencyVnd(item.costPrice || 0)} / {item.unit}</Text>
                      <Text style={styles.staffMeta}>Tổng giá vốn tồn: {formatCurrencyVnd((item.costPrice || 0) * (item.stock || 0))}</Text>
                    </View>
                    <View style={[styles.statusBadge, statusStyle]}>
                      <Text style={styles.statusText}>{getInventoryFilterLabel(stockStatus)}</Text>
                    </View>
                  </View>

                  <View style={styles.inventoryActionRow}>
                    <TouchableOpacity activeOpacity={0.8} style={[styles.buttonBase, styles.buttonSecondary, styles.flex1]} onPress={() => openEditForm(item)}>
                      <Text style={styles.buttonText}>Sửa</Text>
                    </TouchableOpacity>
                    <TouchableOpacity activeOpacity={0.8} style={[styles.buttonBase, styles.buttonPrimary, styles.flex1]} onPress={() => openAdjustPanel(item)}>
                      <Text style={styles.buttonText}>Điều chỉnh tồn</Text>
                    </TouchableOpacity>
                    <TouchableOpacity activeOpacity={0.8} style={[styles.buttonBase, styles.buttonAmber, styles.flex1]} onPress={() => confirmDeleteItem(item)}>
                      <Text style={styles.buttonText}>Xóa</Text>
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
