import { api } from './api';

export type OrderItemStatus = 'PENDING' | 'PREPARING' | 'READY' | 'CANCELLED';
export type OrderStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface OrderTableRef {
  _id?: string;
  name?: string;
  status?: string;
}

export interface OrderItemRef {
  _id?: string;
  name?: string;
  unit?: string;
  category?: string;
  imageUrl?: string;
}

export interface OrderItem {
  _id?: string;
  itemId: string | OrderItemRef;
  quantity: number;
  price: number;
  note?: string;
  status: OrderItemStatus;
  isFree?: boolean;
}

export interface ActiveOrder {
  _id: string;
  tableId?: string | OrderTableRef;
  items: OrderItem[];
  status: OrderStatus;
  totalAmount?: number;
  finalAmount?: number;
  confirmedAt?: string;
  completedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateOrderItemInput {
  itemId: string;
  quantity: number;
  note?: string;
}

export interface CreateStaffOrderInput {
  tableId: string;
  items: CreateOrderItemInput[];
  customerName?: string;
  customerPhone?: string;
  orderNote?: string;
}

export async function getActiveOrders() {
  const res = await api.get('/orders/active');
  return Array.isArray(res.data) ? (res.data as ActiveOrder[]) : [];
}

export async function createStaffOrder(payload: CreateStaffOrderInput) {
  const res = await api.post('/orders/staff', payload);
  return res.data as ActiveOrder;
}

export async function confirmOrder(orderId: string) {
  const res = await api.patch(`/orders/${orderId}/confirm`, {});
  return res.data as ActiveOrder;
}

export async function rejectOrder(orderId: string, reason?: string) {
  const res = await api.patch(`/orders/${orderId}/reject`, { reason });
  return res.data as ActiveOrder;
}

export async function updateOrderItemStatus(orderId: string, itemId: string, status: OrderItemStatus) {
  const res = await api.patch(`/orders/${orderId}/items/${itemId}/status`, { status });
  return res.data as ActiveOrder;
}

export async function checkoutOrder(orderId: string, discount = 0, discountType: 'FLAT' | 'PERCENT' = 'FLAT') {
  const res = await api.post(`/orders/${orderId}/checkout`, { discount, discountType });
  return res.data as ActiveOrder;
}
