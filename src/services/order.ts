import { api } from './api';

export type OrderItemStatus = 'PENDING' | 'PREPARING' | 'READY' | 'SERVED' | 'CANCELLED';
export type OrderStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type CustomerRequestStatus = 'PENDING' | 'ACKNOWLEDGED' | 'DONE' | 'CANCELLED';
export type CustomerRequestType = 'CALL_STAFF' | 'PAY_CASH' | 'PAY_TRANSFER' | 'PRINT_BILL';

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
  sellingPrice?: number;
  status?: string;
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
  sessionId?: string | { _id?: string };
  items: OrderItem[];
  status: OrderStatus;
  totalAmount?: number;
  finalAmount?: number;
  confirmedAt?: string;
  completedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CustomerRequest {
  _id: string;
  type: CustomerRequestType;
  status: CustomerRequestStatus;
  paymentMethod?: 'CASH' | 'TRANSFER';
  message?: string;
  customerName?: string;
  customerPhone?: string;
  tableName?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface StaffWorkspaceSession {
  sessionId: string;
  table: OrderTableRef;
  customer: {
    name?: string;
    phone?: string;
  };
  paymentStatus?: 'UNPAID' | 'REQUESTED' | 'PAID';
  paymentMethod?: 'CASH' | 'TRANSFER' | 'MANUAL';
  openedAt?: string;
  lastActivityAt?: string;
  orders: ActiveOrder[];
  requests: CustomerRequest[];
  bill: {
    orderCount: number;
    itemCount: number;
    totalQuantity: number;
    subtotal: number;
    finalAmount: number;
    items: OrderItem[];
  };
}

export interface KitchenQueueItem {
  orderId: string;
  orderCode?: string;
  orderItemId: string;
  tableId?: string;
  tableName?: string;
  sessionId?: string;
  itemId?: string;
  name: string;
  quantity: number;
  note?: string;
  status: Extract<OrderItemStatus, 'PREPARING' | 'READY'>;
  createdAt?: string;
  confirmedAt?: string;
}

export interface CreateOrderItemInput {
  menuItemId?: string;
  // Legacy compatibility for older payloads
  itemId?: string;
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

export async function getStaffWorkspace() {
  const res = await api.get('/orders/staff/workspace');
  return Array.isArray(res.data?.sessions) ? (res.data.sessions as StaffWorkspaceSession[]) : [];
}

export async function getKitchenQueue() {
  const res = await api.get('/orders/kitchen/queue');
  return Array.isArray(res.data?.items) ? (res.data.items as KitchenQueueItem[]) : [];
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

export async function updateCustomerRequestStatus(requestId: string, status: Exclude<CustomerRequestStatus, 'PENDING'>) {
  const res = await api.patch(`/orders/customer-requests/${requestId}/status`, { status });
  return res.data as CustomerRequest;
}

export async function checkoutOrder(orderId: string, discount = 0, discountType: 'FLAT' | 'PERCENT' = 'FLAT') {
  const res = await api.post(`/orders/${orderId}/checkout`, { discount, discountType });
  return res.data as ActiveOrder;
}

export async function manualCheckoutTableSession(
  sessionId: string,
  discount = 0,
  discountType: 'FLAT' | 'PERCENT' = 'FLAT',
) {
  const res = await api.post(`/orders/table-sessions/${sessionId}/manual-checkout`, { discount, discountType });
  return res.data as {
    sessionId: string;
    paymentStatus: 'PAID';
    paymentMethod: 'MANUAL';
    orderIds: string[];
    totalAmount: number;
    paidAt?: string;
  };
}
