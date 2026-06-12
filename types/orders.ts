export type BookingType = "self_arrange" | "concierge";
export type PackageType = "standard" | "plus" | "premium" | "exotic";

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
  | "contact_seller"
  | "inspector_assigned"
  | "scheduled"
  | "in_progress"
  | "report_drafting"
  | "report_review"
  | "delivered"
  | "completed"
  | "on_hold"
  | "needs_buyer_info"
  | "cancelled";

export type PaymentStatus =
  | "not_requested"
  | "unpaid"
  | "requested"
  | "pending"
  | "paid"
  | "paid_manual_verified"
  | "failed"
  | "refunded"
  | "override_approved";

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
  listing_source: "online_marketplace" | "dealership" | "roadside" | null;
  platform_source: string | null;
  vehicle_seen_location: string | null;
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
  payment_required?: boolean | null;
  payment_override_approved?: boolean | null;
  payment_override_reason?: string | null;
  payment_override_by?: string | null;
  payment_override_at?: string | null;
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
  ops_internal_note?: string | null;
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
  seller_email?: string;
  seller_platform?: string;
  seller_contact_status?: string;
  seller_outcome_notes?: string;
  seller_replied_at?: string;
  seller_available_date?: string;
  seller_available_time?: string;
  seller_inspection_address?: string;
  service_zip?: string;
  service_county?: string;
  service_state?: string;
  ops_report_url?: string;
  ops_summary?: string;
  ops_severity_overall?: 'minor' | 'moderate' | 'major' | 'safety_critical' | null;
  assigned_ridechecker_id?: string;
  report_sent_at?: string;
  ridechecker_pay?: number;
  classification_modifier?: string | null;
  classification_reason?: string | null;
  vehicle_mileage?: number | null;
  vehicle_price?: number | null;
  // Pay fields (migration 029)
  base_pay?: number;
  current_offer?: number;
  boost_amount?: number;
  // Assignment / seller status (migration 029 + 032)
  assignment_status?: "unassigned" | "awaiting_acceptance" | "assigned" | "accepted" | "declined" | "expired" | "en_route" | "completed";
  seller_status?: "awaiting" | "confirmed" | "no_response" | "invalid";
  // Manual payment verification (migration 031)
  payment_verification_note?: string | null;
  payment_verified_by?: string | null;
  payment_stripe_reference?: string | null;
  payment_evidence_url?: string | null;
  payment_verified_at?: string | null;
  payment_amount_verified?: number | null;
  payment_payer_email?: string | null;
  // Risk / fraud flags (manual ops flags + auto-generated from classification)
  risk_flags?: Record<string, boolean | string | number> | null;
}

export interface JobBroadcast {
  id: string;
  order_id: string;
  ridechecker_id: string;
  status: "sent" | "accepted" | "declined" | "expired";
  offered_pay: number;
  responded_at: string | null;
  created_at: string;
  updated_at: string;
  // joined from profiles
  ridechecker_name?: string;
  ridechecker_email?: string;
}

export interface RideCheckerPayout {
  id: string;
  ridechecker_id: string;
  order_id: string;
  base_pay: number;
  bonus: number;
  bonus_breakdown: Record<string, number> | null;
  total_pay: number;
  status: "pending" | "approved" | "paid" | "cancelled";
  payout_batch_id: string | null;
  notes: string | null;
  approved_at: string | null;
  approved_by: string | null;
  paid_at: string | null;
  paid_by: string | null;
  created_at: string;
  updated_at: string;
  // joined from profiles
  ridechecker_name?: string;
  ridechecker_email?: string;
  // joined from orders
  order_display_id?: string;
  vehicle_label?: string;
}

export interface RideCheckerPayoutBatch {
  id: string;
  batch_name: string | null;
  total_amount: number;
  payout_count: number;
  status: "pending" | "processing" | "completed" | "cancelled";
  notes: string | null;
  processed_by: string | null;
  processed_at: string | null;
  created_at: string;
  updated_at: string;
}

export type SellerContactChannel = 'fb_message' | 'call' | 'sms' | 'email' | 'buyer_message';
export type SellerContactStatus = 'not_started' | 'attempting' | 'accepted' | 'declined' | 'no_response' | 'invalid_contact';
export type SellerPlatform = 'facebook' | 'craigslist' | 'dealer' | 'other';

export interface SellerContactAttempt {
  id: string;
  order_id: string;
  attempt_number: number;
  channel: SellerContactChannel;
  destination: string | null;
  message_template_key: string | null;
  message_body: string | null;
  status: string;
  error: string | null;
  created_by: string | null;
  created_at: string;
  // Migration 049c
  response_received: boolean;
  response_at: string | null;
  response_notes: string | null;
  // Migration 051 — delivery tracking
  provider_message_id: string | null;
  /** NULL = manual/untracked. Non-null values: queued | sent | delivered | bounced | failed | undeliverable */
  delivery_status: string | null;
  delivery_updated_at: string | null;
  /** System-generated messages (e.g. seller trust confirmation) — excluded from the 3-attempt ops counter */
  is_auto_notification: boolean;
}

export interface NotificationPreferences {
  primary_method?: 'email' | 'sms' | 'phone';
  secondary_method?: 'email' | 'sms' | 'phone';
  fastest_response_method?: 'email' | 'sms' | 'phone';
  sms_opt_in?: boolean;
  email_opt_in?: boolean;
  phone_opt_in?: boolean;
}

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  role: string;
  is_active: boolean;
  created_at: string;
  // Migration 049a
  notification_preferences: NotificationPreferences | null;
  // Migration 049b
  service_radius_miles: number | null;
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

export type AssignmentStatus = 'assigned' | 'accepted' | 'in_progress' | 'submitted' | 'approved' | 'rejected' | 'paid' | 'cancelled';
export type PayoutStatus = 'pending' | 'released' | 'failed';
export type BrakeCondition = 'good' | 'fair' | 'poor' | 'unknown';
export type SeverityLevel = 'minor' | 'moderate' | 'major' | 'safety_critical';

export interface RideCheckerAvailability {
  id: string;
  ridechecker_id: string;
  date: string;
  start_time: string;
  end_time: string;
  max_jobs: number;
  created_at: string;
}

export interface RideCheckerJobAssignment {
  id: string;
  order_id: string;
  ridechecker_id: string;
  status: AssignmentStatus;
  scheduled_start: string | null;
  scheduled_end: string | null;
  accepted_at: string | null;
  started_at: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  job_score: number | null;
  payout_amount: number | null;
  payout_status: string;
  paid_at: string | null;
  payout_method: string | null;
  payout_notes: string | null;
  created_at: string;
}

export interface RideCheckerRawSubmission {
  id: string;
  order_id: string;
  ridechecker_id: string;
  assignment_id: string | null;
  checklist_complete: boolean;
  vin_photo_url: string | null;
  odometer_photo_url: string | null;
  under_hood_photo_url: string | null;
  undercarriage_photo_url: string | null;
  tire_tread_mm_front_left: number | null;
  tire_tread_mm_front_right: number | null;
  tire_tread_mm_rear_left: number | null;
  tire_tread_mm_rear_right: number | null;
  brake_condition: BrakeCondition | null;
  scan_codes: string[] | null;
  cosmetic_exterior: string | null;
  interior_condition: string | null;
  mechanical_issues: string | null;
  test_drive_notes: string | null;
  immediate_concerns: string | null;
  audio_note_url: string | null;
  extra_photos: string[] | null;
  submitted_at: string;
}

export interface TransferableOrderCredit {
  id: string;
  buyer_id: string;
  original_order_id: string;
  credit_amount_cents: number;
  remaining_amount_cents: number;
  package_type: string;
  status: "active" | "used" | "refunded" | "expired";
  expires_at: string;
  created_at: string;
  used_order_id: string | null;
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
