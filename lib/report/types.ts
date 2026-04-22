export type VerdictType =
  | "BUY"
  | "NEGOTIATE"
  | "DO_NOT_BUY_AT_ASKING"
  | "WALK_AWAY";

export type SystemStatus = "GOOD" | "MONITOR" | "RISK" | "FAIL";

export type RepairPriority = "Immediate" | "Soon" | "Optional" | "Monitor";

export interface ReportSystem {
  name: string;
  status: SystemStatus;
  description: string;
  cost_low?: number;
  cost_high?: number;
  cost_note?: string;
}

export interface RepairEstimate {
  item: string;
  priority: RepairPriority;
  cost_low: number;
  cost_high: number;
}

export interface OBDEntry {
  system: string;
  status_label: string;
  codes: string;
  description: string;
  is_active: boolean;
}

export interface NegotiationOption {
  label: string;
  description: string;
}

export interface GeneratedReport {
  verdict: VerdictType;
  verdict_tagline: string;
  top_insights: Array<{
    title: string;
    body: string;
  }>;
  systems: ReportSystem[];
  obd_entries: OBDEntry[];
  repair_estimates: RepairEstimate[];
  total_repair_low: number;
  total_repair_high: number;
  negotiation_options: NegotiationOption[];
  overall_summary: string;
}

export interface ReportMeta {
  report_number: string;
  inspection_date: string;
  vehicle_year: string;
  vehicle_make: string;
  vehicle_model: string;
  vehicle_trim: string;
  vehicle_mileage: string;
  vehicle_price: string;
  inspection_location: string;
  package_tier: string;
  vin_photo_url: string;
  odometer_photo_url: string;
  under_hood_photo_url: string;
  undercarriage_photo_url: string;
  extra_photos: string[];
}

export interface ReportInput {
  vehicle_year: string;
  vehicle_make: string;
  vehicle_model: string;
  vehicle_trim?: string;
  vehicle_mileage?: number;
  vehicle_price?: number;
  inspection_address?: string;
  order_id: string;
  package: string;
  inspection_date: string;
  cosmetic_exterior: string;
  interior_condition: string;
  mechanical_issues: string;
  test_drive_notes: string;
  immediate_concerns: string;
  scan_codes?: string[];
  brake_condition?: string;
  tire_tread_mm_front_left?: number;
  tire_tread_mm_front_right?: number;
  tire_tread_mm_rear_left?: number;
  tire_tread_mm_rear_right?: number;
  vin_photo_url: string;
  odometer_photo_url: string;
  under_hood_photo_url: string;
  undercarriage_photo_url: string;
  extra_photos?: string[];
}
