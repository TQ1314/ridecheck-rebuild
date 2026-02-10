export type BookingType = "self_arrange" | "concierge";
export type PackageType = "standard" | "premium" | "comprehensive";

export type OrderStatus =
  | "submitted"
  | "payment_received"
  | "payment_requested"
  | "seller_contacted"
  | "seller_confirmed"
  | "inspection_scheduled"
  | "inspection_in_progress"
  | "report_drafting"
  | "report_ready"
  | "completed"
  | "cancelled";

export type PaymentStatus =
  | "not_requested"
  | "requested"
  | "paid"
  | "failed"
  | "refunded";

export interface Order {
  id: string;
  customer_id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  vehicle_year: number;
  vehicle_make: string;
  vehicle_model: string;
  vehicle_description: string | null;
  listing_url: string | null;
  seller_name: string | null;
  seller_phone: string | null;
  vehicle_location: string;
  booking_type: BookingType;
  package: PackageType;
  base_price: number;
  discount_amount: number;
  final_price: number;
  payment_status: PaymentStatus;
  payment_intent_id: string | null;
  paid_at: string | null;
  status: OrderStatus;
  preferred_date: string | null;
  scheduled_date: string | null;
  assigned_ops_id: string | null;
  report_url: string | null;
  idempotency_key: string | null;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  role: string;
  is_active: boolean;
  created_at: string;
}

export interface ActivityLogEntry {
  id: string;
  user_id: string | null;
  order_id: string | null;
  action: string;
  details: Record<string, any> | null;
  created_at: string;
}
