export interface RoadTestModule {
  status: "completed" | "not_permitted" | "not_possible";
  engine_behavior?: string[];
  transmission?: string[];
  brakes?: string[];
  steering?: string[];
  suspension?: string[];
  warning_lights?: string[];
  other_lights_noted?: boolean;
  other_lights_description?: string;
  overall?: string[];
  concerns_notes?: string;
  photo_1_url?: string;
  photo_2_url?: string;
}

export interface OBDUploadedFile {
  url: string;
  fileName: string;
  fileType: "image" | "pdf" | "txt" | "csv";
  reviewStatus: "approved_for_report" | "needs_review" | "excluded_from_report";
  ai_extracted?: boolean;
  extraction_confidence?: number;
  ocr_quality?: string;
  scanner_model?: string;
}

export interface OBDDTCCode {
  system: string;
  code: string;
  description: string;
  status: string;
  source?: "manual" | "ai_extracted";
}

export interface OBDModule {
  scan_performed: string;
  scanner_brand?: string;
  uploaded_files?: OBDUploadedFile[];
  dtc_codes?: OBDDTCCode[];
  notes?: string;
  emissions_readiness?: string;
  warning_lights?: string[];
  warning_other_desc?: string;
}

export interface TitleHistoryModule {
  // Title review
  title_review_status?: string;       // yes_reviewed | partial | no_seller | dealer_unavailable | not_applicable
  title_type?: string;                // clean | salvage | rebuilt | bonded | lien | out_of_state | unknown | unable
  vin_match_title?: string;           // yes | no_mismatch | unable | unavailable
  seller_name_match?: string;         // yes | no_third_party | unable | dealer
  title_signed?: string;             // yes | no | unable

  // VIN verification
  dashboard_vin_verified?: string;   // yes | no | unable
  door_jamb_vin_verified?: string;   // yes | no | unable
  vins_matched?: string;             // yes | no_discrepancy | unable
  dashboard_vin_photo_url?: string;
  door_jamb_vin_photo_url?: string;

  // Lien
  lien_status?: string;              // release_present | lien_no_release | no_lien | unable
  lien_notes?: string;

  // Odometer
  odometer_reading?: number;
  odometer_consistency?: string;     // yes | no_discrepancy | unable | unavailable
  odometer_tampering?: string;       // yes | no | unable
  odometer_notes?: string;

  // Flood indicators (observable only)
  flood_indicators?: string[];       // water_staining | mold_odor | interior_rust | mud_silt | corroded_wiring | fogged_lights | unusual_interior_rust | none
  flood_notes?: string;

  // Theft/tampering indicators (observable only)
  tampering_indicators?: string[];   // ignition_steering | vin_plate_altered | vin_mismatch | door_jamb_sticker | non_oem_keys | aftermarket_wiring | lock_damage | none
  tampering_notes?: string;

  // Prior accident/repair indicators (observable only)
  accident_indicators?: string[];    // mismatched_paint | overspray | panel_gaps | replacement_panels | body_filler | structural_weld | airbag_cover | none
  accident_notes?: string;

  // Internal ops review flag (computed server-side)
  ops_review_status?: string;        // normal | ops_review_required | severe_attention_flag
}

export type VerdictType =
  | "LOW_RISK"
  | "MODERATE_RISK"
  | "HIGH_RISK";

export type ConfidenceLevel =
  | "HIGH CONFIDENCE"
  | "MODERATE CONFIDENCE"
  | "LIMITED CONFIDENCE";

export interface ScopeRow {
  system: string;
  level: string;
  status: "assessed" | "partial" | "not_assessed";
}

export type SystemStatus = "GOOD" | "MONITOR" | "RISK" | "FAIL";

export type RepairPriority = "Immediate" | "Soon" | "Optional" | "Monitor";

export interface ReportSystem {
  name: string;
  status: SystemStatus;
  observed: string;
  consideration: string;
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

export interface TitleTransferReadinessSummary {
  transfer_readiness_status:     "ready" | "caution" | "concern" | "unknown";
  risk_flags:                    string[];
  title_present:                 boolean | null;
  seller_name_on_title:          string | null;
  buyer_name_completed:          string | null;
  odometer_disclosure_completed: string | null;
  lien_release_present:          string | null;
  title_signed:                  string | null;
  open_title:                    string | null;
  vin_matches_title:             string | null;
  state_of_title:                string | null;
  summary:                       string;
  checked_at:                    string;
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
  scope_table: ScopeRow[];
  confidence_level: ConfidenceLevel;
  missing_items: string[];
  inspection_location: string;
  package_tier: string;
  vin_photo_url: string;
  odometer_photo_url: string;
  under_hood_photo_url: string;
  undercarriage_photo_url: string;
  extra_photos: string[];
  road_test_module?: RoadTestModule;
  obd_module?: OBDModule;
  title_history_module?: TitleHistoryModule;
  title_transfer_readiness?: TitleTransferReadinessSummary;
  risk_intelligence?: RiskIntelligenceSummary;
  seller_type?: string;
}

export interface RiskIntelligenceSummary {
  overall_score:       number;
  overall_level:       "LOW" | "MODERATE" | "ELEVATED" | "HIGH";
  vin_valid:           boolean | null;
  vin_decoded_make:    string | null;
  vin_decoded_year:    string | null;
  recall_count:        number;
  recall_severity:     string;
  flood_score:         number;
  flood_level:         string;
  flood_active_count:  number;
  theft_status:        string;
  market_variance_pct: number | null;
  pricing_risk:        string | null;
  reasons:             string[];
  hard_stops:          string[];
  checked_at:          string;
}

export interface ReportInput {
  vehicle_year: string;
  vehicle_make: string;
  vehicle_model: string;
  vehicle_trim?: string;
  vehicle_mileage?: number;
  vehicle_price?: number;
  inspection_address?: string;
  listing_source?: "online_marketplace" | "dealership" | "roadside" | null;
  platform_source?: string | null;
  vehicle_seen_location?: string | null;
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
  road_test_module?: RoadTestModule;
  obd_module?: OBDModule;
  title_history_module?: TitleHistoryModule;
}
