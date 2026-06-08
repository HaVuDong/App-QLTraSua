import type { InventoryItem } from '../services/inventory';

export type RecipeUnitOption = {
  label: string;
  factorToBase: number;
};

export type RecipeRow = {
  key: string;
  inventoryItemId: string;
  requiredQuantity: string;
  quantityUnit: string;
};

export function parseOptionalNumberInput(value: string) {
  const normalized = value.trim();
  if (!normalized) return 0;
  return Number(normalized.replace(',', '.'));
}

export function normalizeUnitLabel(unit?: string) {
  return (unit || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function getRecipeUnitOptions(unit?: string): RecipeUnitOption[] {
  const normalized = normalizeUnitLabel(unit);
  const baseLabel = unit?.trim() || '';
  const options: RecipeUnitOption[] = [];
  if (baseLabel) {
    options.push({ label: baseLabel, factorToBase: 1 });
  }

  if (normalized === 'kg') {
    options.push({ label: 'g', factorToBase: 0.001 });
  } else if (normalized === 'g' || normalized === 'gram') {
    options.push({ label: 'kg', factorToBase: 1000 });
  } else if (normalized === 'l' || normalized === 'lit' || normalized === 'liter') {
    options.push({ label: 'ml', factorToBase: 0.001 });
  } else if (normalized === 'ml') {
    options.push({ label: 'lit', factorToBase: 1000 });
  }

  return options.filter((option, index, self) => self.findIndex((candidate) => normalizeUnitLabel(candidate.label) === normalizeUnitLabel(option.label)) === index);
}

export function getRecipeUnitFactor(unit?: string, selectedUnit?: string) {
  const options = getRecipeUnitOptions(unit);
  return options.find((option) => normalizeUnitLabel(option.label) === normalizeUnitLabel(selectedUnit))?.factorToBase || 1;
}

export function getRecipeBaseQuantity(row: RecipeRow, inventoryItem?: InventoryItem) {
  if (!inventoryItem) return 0;
  const displayedQuantity = parseOptionalNumberInput(row.requiredQuantity);
  if (!Number.isFinite(displayedQuantity) || displayedQuantity <= 0) return 0;
  return Number((displayedQuantity * getRecipeUnitFactor(inventoryItem.unit, row.quantityUnit)).toFixed(4));
}

export function getRecipeIngredientCost(row: RecipeRow, inventoryItems: InventoryItem[]) {
  const inventoryItem = inventoryItems.find((item) => item._id === row.inventoryItemId);
  const baseQuantity = getRecipeBaseQuantity(row, inventoryItem);
  const unitCostPrice = Number(inventoryItem?.costPrice || 0);

  if (!inventoryItem || baseQuantity <= 0 || !Number.isFinite(unitCostPrice) || unitCostPrice < 0) {
    return 0;
  }

  return Number((unitCostPrice * baseQuantity).toFixed(2));
}

export function getMenuIngredientCost(recipeRows: RecipeRow[], inventoryItems: InventoryItem[]) {
  return recipeRows.reduce((sum, row) => sum + getRecipeIngredientCost(row, inventoryItems), 0);
}

export function toDisplayRecipeQuantity(requiredQuantity: number, unit?: string) {
  const normalized = normalizeUnitLabel(unit);
  if (normalized === 'kg' && requiredQuantity > 0 && requiredQuantity < 1) {
    return { quantity: String(Number((requiredQuantity * 1000).toFixed(4))), unit: 'g' };
  }
  if ((normalized === 'l' || normalized === 'lit' || normalized === 'liter') && requiredQuantity > 0 && requiredQuantity < 1) {
    return { quantity: String(Number((requiredQuantity * 1000).toFixed(4))), unit: 'ml' };
  }
  return { quantity: String(requiredQuantity), unit: unit || '' };
}
