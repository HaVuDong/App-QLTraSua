import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../../auth/AuthContext';
import { ScreenBackdrop } from '../../components/common/ScreenBackdrop';
import { runConfirmedAction } from '../../components/common/ConfirmAction';
import { EmptyStateView, ErrorStateView, LoadingView, RestrictedStateView } from '../../components/StateViews';
import { MANAGEMENT_ROLES } from '../../constants/roles';
import { getInventoryItems, type InventoryCategory, type InventoryItem } from '../../services/inventory';
import { checkMenuItemAvailability, createMenuItem, deleteMenuItem, getMenuAvailability, getMenuItemRecipe, getMenuItems, saveMenuItemRecipe, updateMenuItem, type MenuAvailabilityResult, type MenuItem, type SaveMenuRecipeIngredientInput } from '../../services/menu';
import { styles } from '../../styles/appStyles';
import { COLORS } from '../../theme';
import { formatCurrencyVnd } from '../../utils/format';
import { getInventoryCategoryLabel, getMenuFilterLabel, getMenuStatusLabel, type MenuViewStatus } from '../../utils/displayLabels';
import { getMenuIngredientCost, getRecipeIngredientCost, getRecipeUnitFactor, getRecipeUnitOptions, normalizeUnitLabel, parseOptionalNumberInput, toDisplayRecipeQuantity, type RecipeRow } from '../../utils/recipeMath';

const INVENTORY_CATEGORY_OPTIONS: InventoryCategory[] = ['DRINK', 'FOOD', 'FRUIT', 'OTHER'];
const MENU_STATUS_FILTER_OPTIONS: Array<MenuViewStatus | 'ALL'> = ['ALL', 'AVAILABLE', 'OUT_OF_STOCK', 'INACTIVE'];
export function MenuManagementScreen() {
  const { user } = useAuth();
  const [items, setItems] = useState<MenuItem[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [availabilityMap, setAvailabilityMap] = useState<Record<string, MenuAvailabilityResult>>({});
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
  const [formSellingPrice, setFormSellingPrice] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formImageUrl, setFormImageUrl] = useState('');
  const [formStatus, setFormStatus] = useState<'ACTIVE' | 'HIDDEN'>('ACTIVE');
  const [recipeRows, setRecipeRows] = useState<RecipeRow[]>([]);
  const [openRecipeDropdownKey, setOpenRecipeDropdownKey] = useState('');
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [recipeLoading, setRecipeLoading] = useState(false);
  const [formError, setFormError] = useState('');

  const fetchMenuData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setScreenLoading(true);
      }
      setLoadError('');
      const [menuRows, availabilityRows, inventoryRows] = await Promise.all([
        getMenuItems(),
        getMenuAvailability(),
        getInventoryItems(),
      ]);
      const nextAvailabilityMap: Record<string, MenuAvailabilityResult> = {};
      availabilityRows.forEach((row) => {
        nextAvailabilityMap[row.menuItemId] = row;
      });
      setItems(menuRows);
      setAvailabilityMap(nextAvailabilityMap);
      setInventoryItems(inventoryRows);
    } catch (err: any) {
      setLoadError(err.response?.data?.message || 'Không thể tải danh sách menu');
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
    setFormSellingPrice('');
    setFormDescription('');
    setFormImageUrl('');
    setFormStatus('ACTIVE');
    setRecipeRows([]);
    setOpenRecipeDropdownKey('');
    setRecipeLoading(false);
    setFormError('');
  }, []);

  const buildEmptyRecipeRow = useCallback(
    (inventoryItemId?: string): RecipeRow => {
      const inventoryItem = inventoryItems.find((item) => item._id === inventoryItemId);
      return {
        key: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        inventoryItemId: inventoryItemId || '',
        requiredQuantity: '',
        quantityUnit: inventoryItem?.unit || '',
      };
    },
    [inventoryItems],
  );

  const openCreateForm = useCallback(() => {
    setFormMode('create');
    setEditingItemId('');
    setFormName('');
    setFormCategory('DRINK');
    setFormSellingPrice('');
    setFormDescription('');
    setFormImageUrl('');
    setFormStatus('ACTIVE');
    setRecipeRows([buildEmptyRecipeRow(inventoryItems[0]?._id)]);
    setOpenRecipeDropdownKey('');
    setRecipeLoading(false);
    setFormError('');
  }, [buildEmptyRecipeRow, inventoryItems]);

  const openEditForm = useCallback((item: MenuItem) => {
    setFormMode('edit');
    setEditingItemId(item._id);
    setFormName(item.name);
    setFormCategory(item.category);
    setFormSellingPrice(String(item.sellingPrice || 0));
    setFormDescription(item.description || '');
    setFormImageUrl(item.imageUrl || '');
    setFormStatus(item.status === 'ACTIVE' ? 'ACTIVE' : 'HIDDEN');
    setFormError('');
    setOpenRecipeDropdownKey('');
    setRecipeLoading(true);
    void (async () => {
      try {
        const recipe = await getMenuItemRecipe(item._id);
        if (!recipe || !Array.isArray(recipe.ingredients) || recipe.ingredients.length === 0) {
          setRecipeRows([buildEmptyRecipeRow(inventoryItems[0]?._id)]);
          return;
        }

        setRecipeRows(
          recipe.ingredients.map((ingredient) => {
            const inventoryItem = inventoryItems.find((row) => row._id === ingredient.inventoryItemId);
            const baseUnit = inventoryItem?.unit || ingredient.unitSnapshot || '';
            const totalQuantity = Number(ingredient.requiredQuantity || 0) * (1 + (Number(ingredient.wastePercent) || 0) / 100);
            const displayQuantity = toDisplayRecipeQuantity(Number(totalQuantity.toFixed(4)), baseUnit);
            return {
              key: `${item._id}_${ingredient.inventoryItemId}`,
              inventoryItemId: ingredient.inventoryItemId,
              requiredQuantity: displayQuantity.quantity,
              quantityUnit: displayQuantity.unit || baseUnit,
            };
          }),
        );
      } catch (err: any) {
        setFormError(err.response?.data?.message || 'Không thể tải công thức món');
        setRecipeRows([buildEmptyRecipeRow(inventoryItems[0]?._id)]);
      } finally {
        setRecipeLoading(false);
      }
    })();
  }, [buildEmptyRecipeRow, inventoryItems]);

  const updateRecipeRow = useCallback((rowKey: string, patch: Partial<RecipeRow>) => {
    setRecipeRows((prev) => prev.map((row) => (row.key === rowKey ? { ...row, ...patch } : row)));
  }, []);

  const selectRecipeIngredient = useCallback((rowKey: string, item: InventoryItem) => {
    updateRecipeRow(rowKey, {
      inventoryItemId: item._id,
      requiredQuantity: '',
      quantityUnit: item.unit,
    });
    setOpenRecipeDropdownKey('');
  }, [updateRecipeRow]);

  const removeRecipeRow = useCallback((rowKey: string) => {
    setRecipeRows((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((row) => row.key !== rowKey);
    });
    setOpenRecipeDropdownKey((currentKey) => (currentKey === rowKey ? '' : currentKey));
  }, []);

  const addRecipeRow = useCallback(() => {
    setRecipeRows((prev) => [...prev, buildEmptyRecipeRow(inventoryItems[0]?._id)]);
  }, [buildEmptyRecipeRow, inventoryItems]);

  const saveMenuItem = useCallback(async () => {
    const name = formName.trim();
    const sellingPrice = parseOptionalNumberInput(formSellingPrice);
    const imageUrl = formImageUrl.trim();
    const description = formDescription.trim();

    if (!name) {
      setFormError('Tên món là bắt buộc');
      return;
    }
    if (!Number.isFinite(sellingPrice) || sellingPrice < 0) {
      setFormError('Giá bán phải là số không âm');
      return;
    }
    if (!Array.isArray(recipeRows) || recipeRows.length === 0) {
      setFormError('Món phải có ít nhất 1 nguyên liệu trong công thức');
      return;
    }

    const seenIngredientIds = new Set<string>();
    const recipePayload: SaveMenuRecipeIngredientInput[] = [];
    let ingredientCostTotal = 0;
    for (const row of recipeRows) {
      const inventoryItemId = row.inventoryItemId.trim();
      const selectedInventoryItem = inventoryItems.find((item) => item._id === inventoryItemId);
      const displayedQuantity = parseOptionalNumberInput(row.requiredQuantity);
      const unitFactor = getRecipeUnitFactor(selectedInventoryItem?.unit, row.quantityUnit);
      const requiredQuantity = Number((displayedQuantity * unitFactor).toFixed(4));

      if (!inventoryItemId) {
        setFormError('Vui lòng chọn đầy đủ nguyên liệu sử dụng');
        return;
      }
      if (!selectedInventoryItem) {
        setFormError('Nguyên liệu đã chọn không tồn tại trong kho');
        return;
      }
      if (seenIngredientIds.has(inventoryItemId)) {
        setFormError('Không được trùng nguyên liệu trong công thức');
        return;
      }
      if (!Number.isFinite(displayedQuantity) || displayedQuantity <= 0 || !Number.isFinite(requiredQuantity) || requiredQuantity <= 0) {
        setFormError('Lượng hao hụt nguyên liệu phải lớn hơn 0');
        return;
      }
      if (!row.quantityUnit) {
        setFormError('Vui lòng chọn đơn vị hao hụt');
        return;
      }

      seenIngredientIds.add(inventoryItemId);
      ingredientCostTotal += getRecipeIngredientCost(row, inventoryItems);
      recipePayload.push({
        inventoryItemId,
        requiredQuantity,
        isOptional: false,
      });
    }

    if (sellingPrice <= ingredientCostTotal) {
      setFormError(`Giá bán phải lớn hơn giá vốn nguyên liệu (${formatCurrencyVnd(ingredientCostTotal)})`);
      return;
    }

    setFormSubmitting(true);
    setFormError('');
    try {
      const payload = {
        name,
        category: formCategory,
        sellingPrice,
        status: formStatus,
        description: description || undefined,
        imageUrl: imageUrl || undefined,
      };

      if (formMode === 'create') {
        const created = await createMenuItem(payload);
        await saveMenuItemRecipe(created._id, recipePayload);
      } else if (formMode === 'edit' && editingItemId) {
        await updateMenuItem(editingItemId, payload);
        await saveMenuItemRecipe(editingItemId, recipePayload);
      }

      resetForm();
      void fetchMenuData(true);
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Không thể lưu món');
    } finally {
      setFormSubmitting(false);
    }
  }, [
    editingItemId,
    fetchMenuData,
    formCategory,
    formDescription,
    formImageUrl,
    formMode,
    formName,
    formSellingPrice,
    formStatus,
    inventoryItems,
    recipeRows,
    resetForm,
  ]);

  const toggleMenuStatus = useCallback((item: MenuItem) => {
    const isActive = item.status === 'ACTIVE';
    runConfirmedAction({
      title: isActive ? 'Tạm ngưng món' : 'Mở bán lại món',
      message: isActive ? `Bạn muốn tạm ngưng món "${item.name}"?` : `Bạn muốn cho món "${item.name}" bán lại?`,
      confirmText: 'Xác nhận',
      onConfirm: async () => {
        try {
          await updateMenuItem(item._id, { status: isActive ? 'HIDDEN' : 'ACTIVE' });
          void fetchMenuData(true);
        } catch (err: any) {
          Alert.alert('Lỗi', err.response?.data?.message || 'Không thể cập nhật trạng thái món');
        }
      },
    });
  }, [fetchMenuData]);

  const confirmDeleteMenuItem = useCallback((item: MenuItem) => {
    runConfirmedAction({
      title: 'Xóa món',
      message: `Bạn chắc chắn muốn xóa món "${item.name}"?`,
      confirmText: 'Xóa món',
      destructive: true,
      onConfirm: async () => {
        try {
          await deleteMenuItem(item._id);
          void fetchMenuData(true);
        } catch (err: any) {
          Alert.alert('Không thể xóa', err.response?.data?.message || 'Xóa món thất bại');
        }
      },
    });
  }, [fetchMenuData]);

  if (!user || !MANAGEMENT_ROLES.includes(user.role)) {
    return (
      <View style={styles.screenContainer}>
        <ScreenBackdrop />
        <RestrictedStateView message="Bạn không có quyền truy cập màn hình menu." />
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

  const resolveMenuViewStatus = (item: MenuItem): MenuViewStatus => {
    if (item.status !== 'ACTIVE') return 'INACTIVE';
    const availability = availabilityMap[item._id];
    if (!availability) return 'AVAILABLE';
    return availability.available ? 'AVAILABLE' : 'OUT_OF_STOCK';
  };

  const keyword = search.trim().toLowerCase();
  const filteredItems = items.filter((item) => {
    if (keyword && !item.name.toLowerCase().includes(keyword)) {
      return false;
    }
    if (categoryFilter !== 'ALL' && item.category !== categoryFilter) {
      return false;
    }
    const viewStatus = resolveMenuViewStatus(item);
    if (statusFilter !== 'ALL' && viewStatus !== statusFilter) {
      return false;
    }
    return true;
  });

  const availableCount = items.filter((item) => resolveMenuViewStatus(item) === 'AVAILABLE').length;
  const outOfStockCount = items.filter((item) => resolveMenuViewStatus(item) === 'OUT_OF_STOCK').length;
  const inactiveCount = items.filter((item) => resolveMenuViewStatus(item) === 'INACTIVE').length;
  const currentIngredientCost = getMenuIngredientCost(recipeRows, inventoryItems);
  const currentSellingPrice = parseOptionalNumberInput(formSellingPrice);
  const hasMenuPricingSignal = formSellingPrice.trim().length > 0 || currentIngredientCost > 0;
  const isSellingPriceTooLow = Boolean(formMode) && hasMenuPricingSignal && currentSellingPrice <= currentIngredientCost;
  const isMenuSaveDisabled = Boolean(formMode) && (formSubmitting || currentSellingPrice <= currentIngredientCost);

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
          <Text style={styles.sectionTitle}>Quản lý menu</Text>

          <View style={styles.metricGrid}>
            <View style={[styles.glassCard, styles.metricCard]}>
              <Text style={styles.metricLabel}>Đang bán</Text>
              <Text style={styles.metricValue}>{availableCount}</Text>
            </View>
            <View style={[styles.glassCard, styles.metricCard]}>
              <Text style={styles.metricLabel}>Hết món</Text>
              <Text style={styles.metricValue}>{outOfStockCount}</Text>
            </View>
            <View style={[styles.glassCard, styles.metricCard]}>
              <Text style={styles.metricLabel}>Tạm ngưng</Text>
              <Text style={styles.metricValue}>{inactiveCount}</Text>
            </View>
          </View>

          <View style={[styles.glassCard, styles.inventoryToolbar]}>
            <TextInput
              placeholder="Tìm theo tên món"
              value={search}
              onChangeText={setSearch}
              placeholderTextColor={COLORS.textMuted}
              style={styles.input}
            />

            <Text style={styles.helperText}>Lọc theo danh mục</Text>
            <View style={styles.filterRow}>
              <TouchableOpacity
                activeOpacity={0.8}
                style={[styles.filterChip, categoryFilter === 'ALL' ? styles.filterChipActive : null]}
                onPress={() => setCategoryFilter('ALL')}
              >
                <Text style={[styles.filterChipText, categoryFilter === 'ALL' ? styles.filterChipTextActive : null]}>Tất cả</Text>
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
                    <Text style={[styles.filterChipText, selected ? styles.filterChipTextActive : null]}>{getInventoryCategoryLabel(category)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.helperText}>Lọc theo trạng thái</Text>
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
              <Text style={styles.buttonText}>Thêm món</Text>
            </TouchableOpacity>
          </View>

          {formMode ? (
            <View style={[styles.glassCard, styles.formCard]}>
              <Text style={styles.sectionTitle}>{formMode === 'create' ? 'Thêm món' : 'Sửa món'}</Text>
              {formError ? <Text style={styles.errorText}>{formError}</Text> : null}

              <Text style={styles.fieldLabel}>Tên món</Text>
              <TextInput placeholder="Tên món" value={formName} onChangeText={setFormName} placeholderTextColor={COLORS.textMuted} style={styles.input} />
              <Text style={styles.fieldLabel}>Giá bán</Text>
              <TextInput
                placeholder="Giá bán"
                value={formSellingPrice}
                onChangeText={setFormSellingPrice}
                keyboardType="decimal-pad"
                placeholderTextColor={COLORS.textMuted}
                style={[styles.input, isSellingPriceTooLow ? styles.inputWarning : null]}
              />
              {isSellingPriceTooLow ? <Text style={styles.errorText}>Giá bán phải lớn hơn giá vốn nguyên liệu.</Text> : null}
              <TextInput
                placeholder="Mô tả món (tùy chọn)"
                value={formDescription}
                onChangeText={setFormDescription}
                placeholderTextColor={COLORS.textMuted}
                style={styles.input}
              />
              <TextInput
                placeholder="Đường dẫn ảnh (nếu có)"
                value={formImageUrl}
                onChangeText={setFormImageUrl}
                placeholderTextColor={COLORS.textMuted}
                style={styles.input}
              />

              <Text style={styles.helperText}>Danh mục</Text>
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

              <Text style={styles.helperText}>Trạng thái bán</Text>
              <View style={styles.filterRow}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  style={[styles.filterChip, formStatus === 'ACTIVE' ? styles.filterChipActive : null]}
                  onPress={() => setFormStatus('ACTIVE')}
                >
                  <Text style={[styles.filterChipText, formStatus === 'ACTIVE' ? styles.filterChipTextActive : null]}>Đang bán</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.8}
                  style={[styles.filterChip, formStatus === 'HIDDEN' ? styles.filterChipActive : null]}
                  onPress={() => setFormStatus('HIDDEN')}
                >
                  <Text style={[styles.filterChipText, formStatus === 'HIDDEN' ? styles.filterChipTextActive : null]}>Tạm ngưng</Text>
                </TouchableOpacity>
              </View>

              <View style={[styles.glassCard, styles.formCard]}>
                <Text style={styles.sectionTitle}>Nguyên liệu sử dụng</Text>
                {recipeLoading ? <LoadingView /> : null}
                {!recipeLoading ? (
                  <>
                    {recipeRows.map((row, idx) => {
                      const selectedIngredient = inventoryItems.find((ingredient) => ingredient._id === row.inventoryItemId);
                      const unitOptions = getRecipeUnitOptions(selectedIngredient?.unit);
                      const selectedUnit = row.quantityUnit || unitOptions[0]?.label || '';
                      const dropdownOpen = openRecipeDropdownKey === row.key;
                      const rowIngredientCost = getRecipeIngredientCost(row, inventoryItems);

                      return (
                        <View key={row.key} style={[styles.glassCard, styles.staffCard]}>
                          <Text style={styles.staffMeta}>Nguyên liệu #{idx + 1}</Text>
                          <Text style={styles.fieldLabel}>Tên nguyên liệu</Text>
                          <TouchableOpacity
                            activeOpacity={0.8}
                            style={[styles.input, styles.dropdownButton]}
                            onPress={() => setOpenRecipeDropdownKey(dropdownOpen ? '' : row.key)}
                          >
                            <Text style={selectedIngredient ? styles.dropdownButtonText : styles.dropdownPlaceholderText}>
                              {selectedIngredient ? `${selectedIngredient.name} (${selectedIngredient.unit})` : 'Chọn nguyên liệu trong kho'}
                            </Text>
                          </TouchableOpacity>

                          {dropdownOpen ? (
                            <ScrollView style={styles.recipeDropdownList} nestedScrollEnabled showsVerticalScrollIndicator={false}>
                              {inventoryItems.length === 0 ? (
                                <Text style={styles.helperText}>Kho chưa có nguyên liệu.</Text>
                              ) : (
                                inventoryItems.map((ingredient) => {
                                  const selected = ingredient._id === row.inventoryItemId;
                                  return (
                                    <TouchableOpacity
                                      key={`${row.key}_${ingredient._id}`}
                                      activeOpacity={0.8}
                                      style={[styles.recipeDropdownItem, selected ? styles.filterChipActive : null]}
                                      onPress={() => selectRecipeIngredient(row.key, ingredient)}
                                    >
                                      <Text style={[styles.filterChipText, selected ? styles.filterChipTextActive : null]}>
                                        {ingredient.name} ({ingredient.unit})
                                      </Text>
                                    </TouchableOpacity>
                                  );
                                })
                              )}
                            </ScrollView>
                          ) : null}

                          <Text style={styles.fieldLabel}>Lượng hao hụt cho 1 món</Text>
                          <View style={styles.rowSplit}>
                            <TextInput
                              placeholder="Nhập lượng"
                              value={row.requiredQuantity}
                              onChangeText={(value) => updateRecipeRow(row.key, { requiredQuantity: value })}
                              keyboardType="decimal-pad"
                              placeholderTextColor={COLORS.textMuted}
                              style={[styles.input, styles.flex1]}
                            />
                            <View style={[styles.filterRow, styles.recipeUnitPicker]}>
                              {unitOptions.map((option) => {
                                const selected = normalizeUnitLabel(selectedUnit) === normalizeUnitLabel(option.label);
                                return (
                                  <TouchableOpacity
                                    key={`${row.key}_${option.label}`}
                                    activeOpacity={0.8}
                                    style={[styles.filterChip, selected ? styles.filterChipActive : null]}
                                    onPress={() => updateRecipeRow(row.key, { quantityUnit: option.label })}
                                  >
                                    <Text style={[styles.filterChipText, selected ? styles.filterChipTextActive : null]}>{option.label}</Text>
                                  </TouchableOpacity>
                                );
                              })}
                            </View>
                          </View>
                          <Text style={styles.staffMeta}>Giá vốn nguyên liệu dòng này: {formatCurrencyVnd(rowIngredientCost)}</Text>

                          <TouchableOpacity
                            activeOpacity={0.8}
                            disabled={recipeRows.length <= 1}
                            style={[styles.buttonBase, styles.buttonAmber, recipeRows.length <= 1 ? styles.moduleCardDisabled : null]}
                            onPress={() => removeRecipeRow(row.key)}
                          >
                            <Text style={styles.buttonText}>Xóa dòng</Text>
                          </TouchableOpacity>
                        </View>
                      );
                    })}
                    <TouchableOpacity activeOpacity={0.8} style={[styles.buttonBase, styles.buttonSecondary]} onPress={addRecipeRow}>
                      <Text style={styles.buttonText}>Thêm nguyên liệu</Text>
                    </TouchableOpacity>
                  </>
                ) : null}
              </View>

              <Text style={styles.fieldLabel}>Giá vốn nguyên liệu / 1 phần</Text>
              <TextInput
                value={formatCurrencyVnd(currentIngredientCost)}
                editable={false}
                placeholderTextColor={COLORS.textMuted}
                style={[styles.input, styles.readOnlyInput]}
              />
              <Text style={isSellingPriceTooLow ? styles.errorText : styles.helperText}>
                Giá bán hiện tại: {formatCurrencyVnd(currentSellingPrice)}
              </Text>

              <View style={styles.rowSplit}>
                <TouchableOpacity activeOpacity={0.8} style={[styles.buttonBase, styles.buttonSecondary, styles.flex1]} onPress={resetForm}>
                  <Text style={styles.buttonText}>Hủy</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.8}
                  disabled={isMenuSaveDisabled}
                  style={[styles.buttonBase, styles.buttonPrimary, styles.flex1, isMenuSaveDisabled ? styles.moduleCardDisabled : null]}
                  onPress={() => void saveMenuItem()}
                >
                  {formSubmitting ? <ActivityIndicator color={COLORS.text} /> : <Text style={styles.buttonText}>Lưu món</Text>}
                </TouchableOpacity>
              </View>
            </View>
          ) : null}

          {loadError ? <ErrorStateView message={loadError} onRetry={() => void fetchMenuData()} /> : null}

          {!loadError && filteredItems.length === 0 ? (
            <EmptyStateView message="Chưa có món nào trong menu." />
          ) : (
            filteredItems.map((item) => {
              const availability = availabilityMap[item._id];
              const viewStatus = resolveMenuViewStatus(item);
              const statusStyle =
                viewStatus === 'INACTIVE' ? styles.statusPending : viewStatus === 'OUT_OF_STOCK' ? styles.statusLowStock : styles.statusProgress;

              return (
                <View key={item._id} style={[styles.glassCard, styles.inventoryItemCard]}>
                  <View style={styles.staffHeader}>
                    <View style={styles.staffInfo}>
                      <Text style={styles.staffName}>{item.name}</Text>
                      <Text style={styles.staffMeta}>Danh mục: {getInventoryCategoryLabel(item.category)}</Text>
                      <Text style={styles.staffMeta}>Giá bán: {(item.sellingPrice || 0).toLocaleString()}d</Text>
                      {item.description ? <Text style={styles.staffMeta}>Mô tả: {item.description}</Text> : null}
                      {item.imageUrl ? <Text style={styles.staffMeta}>Ảnh: {item.imageUrl}</Text> : null}
                      <Text style={styles.staffMeta}>Tình trạng: {availability?.reason === 'RECIPE_MISSING' ? 'Chưa có công thức' : getMenuStatusLabel(viewStatus)}</Text>
                      {!availability?.available && Array.isArray(availability?.issues) && availability.issues.length > 0 ? (
                        <Text style={styles.staffMeta}>
                          Nguyên liệu thiếu: {availability.issues.map((issue) => `${issue.name} (${issue.availableQuantity}/${issue.requestedQuantity} ${issue.unit})`).join('; ')}
                        </Text>
                      ) : null}
                    </View>
                    <View style={[styles.statusBadge, statusStyle]}>
                      <Text style={styles.statusText}>{getMenuStatusLabel(viewStatus)}</Text>
                    </View>
                  </View>

                  <View style={styles.inventoryActionRow}>
                    <TouchableOpacity activeOpacity={0.8} style={[styles.buttonBase, styles.buttonSecondary, styles.flex1]} onPress={() => openEditForm(item)}>
                      <Text style={styles.buttonText}>Sửa món</Text>
                    </TouchableOpacity>
                    <TouchableOpacity activeOpacity={0.8} style={[styles.buttonBase, styles.buttonPrimary, styles.flex1]} onPress={() => toggleMenuStatus(item)}>
                      <Text style={styles.buttonText}>{item.status === 'ACTIVE' ? 'Tạm ngưng' : 'Đang bán'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity activeOpacity={0.8} style={[styles.buttonBase, styles.buttonAmber, styles.flex1]} onPress={() => confirmDeleteMenuItem(item)}>
                      <Text style={styles.buttonText}>Xóa món</Text>
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
