export type Role = 'partner' | 'admin';

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
