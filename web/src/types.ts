export type Role = 'partner' | 'admin' | 'warehouse';

export interface Warehouse {
  id: string;
  name: string;
  created_at?: string;
}

export type PartnerStatus = 'pending' | 'approved' | 'rejected';

export type OrderStatus = 'new' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';

export interface User {
  id: string;
  email: string;
  phone: string | null;
  contact_name: string | null;
  telegram_id: string | null;
  role: Role;
}

export interface Partner {
  id: string;
  name: string;
  discount_percent: string | number;
  status: PartnerStatus;
}

export interface Profile {
  user: User;
  partner: Partner | null;
}

export interface Address {
  id: string;
  label: string;
  address: string;
  is_default: boolean;
  created_at?: string;
}

export interface Wine {
  id: string;
  name: string;
  price: string | number;
  stock_quantity: number;
  sort_order: number;
}

export interface OrderListItem {
  id: string;
  order_number: number | string;
  status: OrderStatus;
  total_amount: string | number;
  created_at: string;
  updated_at: string;
  address_label: string;
}

export interface OrderItem {
  id: string;
  wine_id: string;
  quantity: number;
  price: string | number;
  name: string;
}

export interface OrderDetail {
  id: string;
  order_number: number | string;
  status: OrderStatus;
  total_amount: string | number;
  comment: string | null;
  created_at: string;
  delivery_address_id: string;
  address_label: string;
  address_text: string;
  items: OrderItem[];
}

export interface AdminOrderListItem {
  id: string;
  order_number: number | string;
  status: OrderStatus;
  total_amount: string | number;
  created_at: string;
  partner_name: string;
  user_contact: string | null;
  address_label: string;
}

export interface AdminOrderDetail extends OrderDetail {
  partner_id: string;
  partner_name: string;
  discount_percent: string | number;
  user_contact: string | null;
  user_phone: string | null;
  user_email: string;
}

export interface AdminWine {
  id: string;
  name: string;
  price: string | number;
  stock_quantity: number;
  sort_order: number;
  is_active: boolean;
  created_at?: string;
}

export interface AdminPartnerUser {
  id: string;
  email: string;
  phone: string | null;
  contact_name: string | null;
  telegram_id: string | null;
}

export interface AdminPartner {
  id: string;
  name: string;
  discount_percent: string | number;
  status: PartnerStatus;
  notes: string | null;
  created_at: string;
  warehouse_id: string | null;
  warehouse_name: string | null;
  users: AdminPartnerUser[];
  addresses: Address[];
}

export interface WarehouseOrderListItem {
  id: string;
  order_number: number | string;
  status: OrderStatus;
  total_amount: string | number;
  created_at: string;
  updated_at: string;
  partner_name: string;
  address_label: string;
  address_text: string;
}

export interface WarehouseOrderDetail extends WarehouseOrderListItem {
  comment: string | null;
  user_contact: string | null;
  user_phone: string | null;
  items: OrderItem[];
}
