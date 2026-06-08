import { api } from './api';
import type { InventoryCategory } from './inventory';

export type MenuItemStatus = 'ACTIVE' | 'HIDDEN' | 'DELETED';
export type MenuManualAvailabilityOverride = 'FORCE_AVAILABLE' | 'FORCE_UNAVAILABLE';

export interface MenuItem {
  _id: string;
  name: string;
  category: InventoryCategory;
  description?: string;
  sellingPrice: number;
  imageUrl?: string;
  status: MenuItemStatus;
  manualAvailabilityOverride?: MenuManualAvailabilityOverride;
  createdAt?: string;
  updatedAt?: string;
}

export interface MenuRecipeIngredient {
  inventoryItemId: string;
  inventoryItemNameSnapshot: string;
  requiredQuantity: number;
  unitSnapshot: string;
  wastePercent?: number;
  isOptional?: boolean;
}

export interface MenuRecipe {
  _id: string;
  menuItemId: string;
  ingredients: MenuRecipeIngredient[];
  version: number;
  status: 'ACTIVE' | 'ARCHIVED';
  createdAt?: string;
  updatedAt?: string;
}

export interface SaveMenuItemInput {
  name: string;
  category: InventoryCategory;
  sellingPrice: number;
  description?: string;
  imageUrl?: string;
  status?: Exclude<MenuItemStatus, 'DELETED'>;
  manualAvailabilityOverride?: MenuManualAvailabilityOverride;
}

export interface SaveMenuRecipeIngredientInput {
  inventoryItemId: string;
  requiredQuantity: number;
  wastePercent?: number;
  isOptional?: boolean;
}

export interface MenuAvailabilityIssue {
  inventoryItemId: string;
  name: string;
  unit: string;
  requestedQuantity: number;
  availableQuantity: number;
  reason: string;
}

export interface MenuAvailabilityResult {
  menuItemId: string;
  name: string;
  quantity: number;
  available: boolean;
  status: 'AVAILABLE' | 'OUT_OF_STOCK' | 'INACTIVE';
  reason?: string;
  issues: MenuAvailabilityIssue[];
}

export async function getMenuItems(search?: string, category?: InventoryCategory | 'ALL') {
  const params: Record<string, string> = {};
  if (search?.trim()) params.search = search.trim();
  if (category && category !== 'ALL') params.category = category;

  const res = await api.get('/menu-items', { params: Object.keys(params).length ? params : undefined });
  return Array.isArray(res.data) ? (res.data as MenuItem[]) : [];
}

export async function createMenuItem(payload: SaveMenuItemInput) {
  const res = await api.post('/menu-items', payload);
  return res.data as MenuItem;
}

export async function updateMenuItem(menuItemId: string, payload: Partial<SaveMenuItemInput>) {
  const res = await api.put(`/menu-items/${menuItemId}`, payload);
  return res.data as MenuItem;
}

export async function deleteMenuItem(menuItemId: string) {
  const res = await api.delete(`/menu-items/${menuItemId}`);
  return res.data as MenuItem;
}

export async function getMenuItemRecipe(menuItemId: string) {
  const res = await api.get(`/menu-items/${menuItemId}/recipe`);
  return (res.data || null) as MenuRecipe | null;
}

export async function saveMenuItemRecipe(menuItemId: string, ingredients: SaveMenuRecipeIngredientInput[]) {
  const res = await api.put(`/menu-items/${menuItemId}/recipe`, { ingredients });
  return res.data as MenuRecipe;
}

export async function getMenuAvailability(quantity = 1) {
  const res = await api.get('/menu-items/availability', { params: { quantity } });
  return Array.isArray(res.data) ? (res.data as MenuAvailabilityResult[]) : [];
}

export async function checkMenuItemAvailability(menuItemId: string, quantity = 1) {
  const rows = await getMenuAvailability(quantity);
  const result = rows.find((row) => row.menuItemId === menuItemId);
  if (result) return result;

  return {
    menuItemId,
    name: 'Mon nay',
    quantity,
    available: false,
    status: 'OUT_OF_STOCK',
    reason: 'RECIPE_MISSING',
    issues: [],
  };
}
