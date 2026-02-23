export type BookingType = "self_arrange" | "concierge";
export type PackageType = "standard" | "premium" | "comprehensive" | "plus";

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

export type OpsStatus =
  | "new"
  | "seller_outreach"
  | "seller_confirmed"
  | "payment_pending"
  | "payment_received"
  | "inspector_assigned"
  | "scheduled"
  | "in_progress"
  | "report_drafting"
  | "report_review"
  | "delivered"
  | "completed"
  | "on_hold"
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
  booking_method?: string;
  package_tier?: string;
  calculated_price_cents?: number;
  preferred_language?: string;
  inspection_address?: string;
  inspection_time_window?: string;
  listing_platform?: string;
  listing_title?: string;
  listing_price?: string;
  listing_location_text?: string;
  vehicle_trim?: string;
  order_status?: string;
  last_error?: string;
  notes_to_inspector?: string;
  ops_status?: OpsStatus;
  assigned_inspector_id?: string;
  assigned_at?: string;
  seller_contact_attempts?: number;
  seller_contacted_at?: string;
  seller_confirmed_at?: string;
  payment_requested_at?: string;
  inspection_scheduled_for?: string;
  inspection_completed_at?: string;
  report_delivered_at?: string;
  ops_priority?: number;
  ops_notes?: string;
  hold_status?: string;
  payment_link_url?: string;
  buyer_email?: string;
  buyer_phone?: string;
  payment_link_token?: string;
  payment_link_sent_to?: string;
  payment_link_sent_channel?: string;
  payment_link_sent_at?: string;
  payment_link_click_ip?: string;
  payment_link_click_ua?: string;
  stripe_session_id?: string;
  report_status?: string;
  report_storage_path?: string;
  report_uploaded_at?: string;
  qa_status?: string;
  qa_notes?: string;
  qa_reviewed_by?: string;
  qa_reviewed_at?: string;
  inspector_status?: string;
  inspector_notes?: string;
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

export interface OrderEvent {
  id: string;
  order_id: string;
  event_type: string;
  actor_id: string | null;
  actor_email: string | null;
  details: Record<string, any> | null;
  is_internal: boolean;
  created_at: string;
}

export interface AuditLogEntry {
  id: string;
  actor_id: string | null;
  actor_email: string | null;
  actor_role: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  old_value: Record<string, any> | null;
  new_value: Record<string, any> | null;
  metadata: Record<string, any> | null;
  ip_address: string | null;
  created_at: string;
}

export interface Inspector {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  region: string | null;
  specialties: string[] | null;
  is_active: boolean;
  max_daily_capacity: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface IntelligenceReport {
  id: string;
  order_id: string;
  report_type: string;
  vin_consistency_check: Record<string, any> | null;
  fraud_screening: Record<string, any> | null;
  title_ownership_review: Record<string, any> | null;
  risk_flags: Record<string, any> | null;
  observations: string | null;
  inspector_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserInvite {
  id: string;
  email: string;
  role: string;
  token: string;
  expires_at: string;
  created_by: string | null;
  used_at: string | null;
  created_at: string;
}

export interface BillOfSaleDocument {
  id: string;
  order_id: string;
  language: string;
  buyer_name: string | null;
  seller_name: string | null;
  vehicle_description: string | null;
  sale_price: string | null;
  document_html: string | null;
  created_at: string;
}
