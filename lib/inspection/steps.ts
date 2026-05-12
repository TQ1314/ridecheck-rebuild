// ─────────────────────────────────────────────────────────────────────────────
// Guided Inspection Step Definitions
// Single source of truth for the wizard — used by both UI and API.
// ─────────────────────────────────────────────────────────────────────────────

export interface InspectionStep {
  key: string;
  section: string;
  sectionNumber: number;
  title: string;
  whyItMatters: string;
  instruction: string;
  widePhotoLabel: string;
  widePhotoHint: string;
  closePhotoLabel: string;
  closePhotoHint: string;
  requiresPhotos: boolean;
  allowNotAccessible: boolean;
  noteRequiredWhen: "always" | "concern" | "not_accessible_or_concern" | "never";
  /** Minimum photos required (wide + close = 2 for most steps). */
  requiredPhotoCount: number;
}

export const INSPECTION_STEPS: InspectionStep[] = [
  // ── SECTION 1 — Identity & Paperwork ────────────────────────────────────
  {
    key: "vin_dashboard",
    section: "Identity & Paperwork",
    sectionNumber: 1,
    title: "VIN — Dashboard Plate",
    whyItMatters: "The VIN confirms the vehicle's identity. A mismatch is a serious red flag for fraud.",
    instruction: "Photograph the VIN plate through the lower-left windshield from outside. Then move to the driver door jamb and photograph the VIN sticker on the door pillar — both must be legible.",
    widePhotoLabel: "VIN — Windshield (exterior)",
    widePhotoHint: "Step back 2–3 ft. Capture full lower windshield so the VIN plate is visible.",
    closePhotoLabel: "VIN — Door Jamb Sticker",
    closePhotoHint: "Open the driver door. Photograph the VIN sticker on the door pillar. All 17 characters must be legible.",
    requiresPhotos: true,
    allowNotAccessible: false,
    noteRequiredWhen: "concern",
    requiredPhotoCount: 2,
  },
  {
    key: "odometer",
    section: "Identity & Paperwork",
    sectionNumber: 1,
    title: "Odometer Reading",
    whyItMatters: "Odometer fraud is common. A timestamped photo proves actual mileage.",
    instruction: "Turn ignition to ON (engine does not need to run). Photograph the full dashboard and a close-up of the odometer reading.",
    widePhotoLabel: "Wide — Full dashboard",
    widePhotoHint: "Capture the entire gauge cluster with all visible warning lights.",
    closePhotoLabel: "Close — Odometer mileage",
    closePhotoHint: "Mileage must be clearly readable. Include any warning lights in frame.",
    requiresPhotos: true,
    allowNotAccessible: false,
    noteRequiredWhen: "concern",
    requiredPhotoCount: 2,
  },
  {
    key: "title_paperwork",
    section: "Identity & Paperwork",
    sectionNumber: 1,
    title: "Title / Paperwork",
    whyItMatters: "Title issues, salvage branding, or liens are hidden from online listings.",
    instruction: "If the seller allows, photograph the title or available paperwork. Avoid capturing private information beyond the VIN and title status area.",
    widePhotoLabel: "Wide — Document in context",
    widePhotoHint: "Show the document laid flat on a surface.",
    closePhotoLabel: "Close — VIN / title status field",
    closePhotoHint: "Capture the VIN line and any branding (salvage, rebuilt, etc.).",
    requiresPhotos: true,
    allowNotAccessible: true,
    noteRequiredWhen: "not_accessible_or_concern",
    requiredPhotoCount: 2,
  },

  // ── SECTION 2 — Exterior & Body ──────────────────────────────────────────
  {
    key: "exterior_front",
    section: "Exterior & Body",
    sectionNumber: 2,
    title: "Front Exterior",
    whyItMatters: "Front-end damage often indicates past collisions not disclosed by the seller.",
    instruction: "Stand 6–8 feet in front. Take a wide 3/4 angle shot, then close-ups of the bumper, grille, and headlights.",
    widePhotoLabel: "Wide — Full front 3/4 angle",
    widePhotoHint: "Bumper to roof, full width of the front.",
    closePhotoLabel: "Close — Bumper / headlights",
    closePhotoHint: "Focus on damage, cracks, paint mismatch, or misalignment.",
    requiresPhotos: true,
    allowNotAccessible: false,
    noteRequiredWhen: "concern",
    requiredPhotoCount: 2,
  },
  {
    key: "exterior_rear",
    section: "Exterior & Body",
    sectionNumber: 2,
    title: "Rear Exterior",
    whyItMatters: "Rear collision damage and rust are common undisclosed issues.",
    instruction: "Stand 6–8 feet behind. Wide 3/4 rear angle, then close-up of the rear bumper and trunk/tailgate area.",
    widePhotoLabel: "Wide — Full rear 3/4 angle",
    widePhotoHint: "Bumper to roof, full rear width.",
    closePhotoLabel: "Close — Bumper / tailgate",
    closePhotoHint: "Note cracking, paint fade, damage, or misalignment.",
    requiresPhotos: true,
    allowNotAccessible: false,
    noteRequiredWhen: "concern",
    requiredPhotoCount: 2,
  },
  {
    key: "exterior_driver_side",
    section: "Exterior & Body",
    sectionNumber: 2,
    title: "Driver Side Exterior",
    whyItMatters: "Door dings, rocker rust, and paint repairs are most common on the driver side.",
    instruction: "Stand perpendicular. Full-length side shot, then crouch for a close-up of the rocker panel and lower door.",
    widePhotoLabel: "Wide — Full driver side",
    widePhotoHint: "Front wheel to rear wheel, ground to roofline.",
    closePhotoLabel: "Close — Rocker panel / lower door",
    closePhotoHint: "Look for rust, dents, repair patches, or paint bubbling.",
    requiresPhotos: true,
    allowNotAccessible: false,
    noteRequiredWhen: "concern",
    requiredPhotoCount: 2,
  },
  {
    key: "exterior_passenger_side",
    section: "Exterior & Body",
    sectionNumber: 2,
    title: "Passenger Side Exterior",
    whyItMatters: "Curb rash and unreported panel repairs are frequently on the passenger side.",
    instruction: "Mirror the driver side process. Full-length side shot, then close-up of the rocker panel.",
    widePhotoLabel: "Wide — Full passenger side",
    widePhotoHint: "Front wheel to rear wheel, ground to roofline.",
    closePhotoLabel: "Close — Rocker panel / lower door",
    closePhotoHint: "Look for rust, dents, curb rash, or mismatched paint.",
    requiresPhotos: true,
    allowNotAccessible: false,
    noteRequiredWhen: "concern",
    requiredPhotoCount: 2,
  },
  {
    key: "body_damage",
    section: "Exterior & Body",
    sectionNumber: 2,
    title: "Rust / Body Damage",
    whyItMatters: "Rust and unrepaired body damage affect structural integrity and resale value.",
    instruction: "Walk the full vehicle looking for rust, dents, mismatched paint, panel gaps, or accident evidence. Photograph the worst area found — or show a clean panel if no damage is present.",
    widePhotoLabel: "Wide — Location context",
    widePhotoHint: "Show which part of the car and its surroundings.",
    closePhotoLabel: "Close — Damage detail (or clean panel)",
    closePhotoHint: "Show rust depth, dent size, or paint issue clearly. If clean, show a representative clean panel.",
    requiresPhotos: true,
    allowNotAccessible: true,
    noteRequiredWhen: "not_accessible_or_concern",
    requiredPhotoCount: 2,
  },

  // ── SECTION 3 — Tires & Wheels ───────────────────────────────────────────
  {
    key: "tires_front",
    section: "Tires & Wheels",
    sectionNumber: 3,
    title: "Front Tires",
    whyItMatters: "Worn or mismatched tires are a safety issue and indicate vehicle neglect.",
    instruction: "Photograph both front tires. Full wheel shot, then a close-up showing tread depth, sidewall, and DOT date code if visible.",
    widePhotoLabel: "Wide — Full front wheel/tire",
    widePhotoHint: "Capture the whole wheel including rim from the side.",
    closePhotoLabel: "Close — Tread / sidewall",
    closePhotoHint: "Show tread grooves, cracking, bulges, or uneven wear. Date code if visible.",
    requiresPhotos: true,
    allowNotAccessible: false,
    noteRequiredWhen: "concern",
    requiredPhotoCount: 2,
  },
  {
    key: "tires_rear",
    section: "Tires & Wheels",
    sectionNumber: 3,
    title: "Rear Tires",
    whyItMatters: "Rear tire wear patterns reveal alignment and suspension issues.",
    instruction: "Same as front tires. Photograph both rear tires — full wheel then tread close-up.",
    widePhotoLabel: "Wide — Full rear wheel/tire",
    widePhotoHint: "Capture the whole wheel including rim from the side.",
    closePhotoLabel: "Close — Tread / sidewall",
    closePhotoHint: "Show tread grooves, cracking, bulges, or uneven wear.",
    requiresPhotos: true,
    allowNotAccessible: false,
    noteRequiredWhen: "concern",
    requiredPhotoCount: 2,
  },

  // ── SECTION 4 — Interior & Electronics ──────────────────────────────────
  {
    key: "interior_driver",
    section: "Interior & Electronics",
    sectionNumber: 4,
    title: "Driver Interior",
    whyItMatters: "Interior wear reveals real usage vs. disclosed mileage and condition.",
    instruction: "Open the driver door. Wide shot of full front interior, then close-up of the driver seat bolster, pedals, and most-worn area.",
    widePhotoLabel: "Wide — Full front interior",
    widePhotoHint: "Capture seats, dashboard, center console, and headliner.",
    closePhotoLabel: "Close — Driver seat / pedals / wear",
    closePhotoHint: "Focus on seat bolster, pedal wear, and floor mat condition.",
    requiresPhotos: true,
    allowNotAccessible: false,
    noteRequiredWhen: "concern",
    requiredPhotoCount: 2,
  },
  {
    key: "dashboard_warning_lights",
    section: "Interior & Electronics",
    sectionNumber: 4,
    title: "Dashboard Warning Lights",
    whyItMatters: "Warning lights indicate mechanical issues that may be hidden from buyers.",
    instruction: "With ignition ON (engine running if possible), photograph the full dashboard and a close-up of the warning light cluster.",
    widePhotoLabel: "Wide — Full dashboard, ignition ON",
    widePhotoHint: "Capture from steering column to infotainment screen.",
    closePhotoLabel: "Close — Warning light cluster",
    closePhotoHint: "Focus on the instrument cluster. All illuminated warning lights must be visible.",
    requiresPhotos: true,
    allowNotAccessible: false,
    noteRequiredWhen: "concern",
    requiredPhotoCount: 2,
  },
  {
    key: "basic_controls",
    section: "Interior & Electronics",
    sectionNumber: 4,
    title: "Basic Controls Check",
    whyItMatters: "Non-working controls are costly repairs buyers rarely expect.",
    instruction: "Test: headlights, horn, power windows, door locks, wipers, AC/heat (if seller allows). Document any failures.",
    widePhotoLabel: "Wide — Dashboard / control area",
    widePhotoHint: "Show the overall control layout.",
    closePhotoLabel: "Close — Any failed control or indicator",
    closePhotoHint: "Photograph any switch that does not work or any warning. If all OK, show the AC/heat controls working.",
    requiresPhotos: true,
    allowNotAccessible: true,
    noteRequiredWhen: "not_accessible_or_concern",
    requiredPhotoCount: 2,
  },

  // ── SECTION 5 — Engine Bay ───────────────────────────────────────────────
  {
    key: "engine_bay_overview",
    section: "Engine Bay",
    sectionNumber: 5,
    title: "Engine Bay Overview",
    whyItMatters: "A clean engine bay can hide recent resprays; a messy one reveals neglect or leaks.",
    instruction: "Open the hood fully. Photograph the entire engine bay from above, then zoom in on any area of concern.",
    widePhotoLabel: "Wide — Full engine bay from above",
    widePhotoHint: "Capture the entire engine compartment.",
    closePhotoLabel: "Close — Concern or general detail",
    closePhotoHint: "If clean, focus on the engine top. If concern exists, capture it clearly.",
    requiresPhotos: true,
    allowNotAccessible: false,
    noteRequiredWhen: "concern",
    requiredPhotoCount: 2,
  },
  {
    key: "oil_dipstick",
    section: "Engine Bay",
    sectionNumber: 5,
    title: "Oil Cap & Dipstick",
    whyItMatters: "Oil condition and color reveal engine health and maintenance history.",
    instruction: "Remove the oil dipstick and photograph it alongside the oil cap underside. Dark oil, milky residue, or a gritty cap are red flags.",
    widePhotoLabel: "Wide — Oil cap/dipstick location",
    widePhotoHint: "Show where in the engine bay the oil cap is located.",
    closePhotoLabel: "Close — Dipstick or cap underside",
    closePhotoHint: "Show oil color and any residue or milkiness clearly.",
    requiresPhotos: true,
    allowNotAccessible: true,
    noteRequiredWhen: "not_accessible_or_concern",
    requiredPhotoCount: 2,
  },
  {
    key: "fluids_leaks",
    section: "Engine Bay",
    sectionNumber: 5,
    title: "Fluids & Visible Leaks",
    whyItMatters: "Active leaks indicate mechanical issues that are expensive to repair.",
    instruction: "Inspect the lower engine bay and the ground under the car for fluid stains or active drips. Photograph the engine underside and any stains found.",
    widePhotoLabel: "Wide — Lower engine bay",
    widePhotoHint: "Show the bottom of the engine and any visible drips or staining.",
    closePhotoLabel: "Close — Leak / stain detail (or clean ground)",
    closePhotoHint: "If clean, photograph the ground under the engine. If a leak is present, get close to show the source.",
    requiresPhotos: true,
    allowNotAccessible: false,
    noteRequiredWhen: "concern",
    requiredPhotoCount: 2,
  },

  // ── SECTION 6 — Underbody ────────────────────────────────────────────────
  {
    key: "underbody_front",
    section: "Underbody & Rust",
    sectionNumber: 6,
    title: "Front Underbody",
    whyItMatters: "Frame rust, bent subframe, and suspension damage are invisible from the outside.",
    instruction: "Crouch at the front bumper and angle your phone under the car. Capture the front frame rails, suspension, and any fluid traces. Take a third angle from the driver side wheel well.",
    widePhotoLabel: "Angle 1 — Front center (shoot rearward)",
    widePhotoHint: "Shoot under the car from the front bumper center, angled toward the rear.",
    closePhotoLabel: "Angle 2 — Driver-side front suspension",
    closePhotoHint: "Focus on rust scale, bent metal, leaking CV boots, or damaged bushings.",
    requiresPhotos: true,
    allowNotAccessible: false,
    noteRequiredWhen: "concern",
    requiredPhotoCount: 2,
  },
  {
    key: "underbody_rear",
    section: "Underbody & Rust",
    sectionNumber: 6,
    title: "Rear Underbody",
    whyItMatters: "Exhaust condition, rear axle/suspension, and fuel lines are all visible here.",
    instruction: "Move to the rear. Angle the phone under to capture the rear frame, exhaust, rear suspension, and muffler. Take a third angle from the passenger-side rear wheel well.",
    widePhotoLabel: "Angle 3 — Rear center (shoot forward)",
    widePhotoHint: "Shoot under the car from the rear bumper center, angled toward the front.",
    closePhotoLabel: "Angle 4 — Exhaust / rear suspension",
    closePhotoHint: "Look for rust holes, cracked exhaust, oil on the axle, or damaged mounts.",
    requiresPhotos: true,
    allowNotAccessible: false,
    noteRequiredWhen: "concern",
    requiredPhotoCount: 2,
  },

  // ── SECTION 7 — OBD / Diagnostic ────────────────────────────────────────
  {
    key: "obd_scan",
    section: "OBD / Diagnostic",
    sectionNumber: 7,
    title: "OBD-II Scan Result",
    whyItMatters: "Stored fault codes reveal problems cleared before sale.",
    instruction: "Plug your OBD-II scanner into the port (under the dash, driver's side). Photograph the scanner connected, then the results screen showing all codes.",
    widePhotoLabel: "Wide — Scanner plugged into OBD port",
    widePhotoHint: "Show the scanner connected to the OBD-II port.",
    closePhotoLabel: "Close — Results screen",
    closePhotoHint: "Capture all code listings including cleared/pending codes.",
    requiresPhotos: true,
    allowNotAccessible: true,
    noteRequiredWhen: "not_accessible_or_concern",
    requiredPhotoCount: 2,
  },
  {
    key: "obd_readiness",
    section: "OBD / Diagnostic",
    sectionNumber: 7,
    title: "Readiness Monitors",
    whyItMatters: "Incomplete readiness monitors mean codes were recently cleared — a common dealer trick.",
    instruction: "While scanner is connected, navigate to 'Readiness' or 'I/M Monitors'. Photograph the full readiness status list.",
    widePhotoLabel: "Wide — Scanner / app screen",
    widePhotoHint: "Show the full screen of your scanner app.",
    closePhotoLabel: "Close — Readiness status",
    closePhotoHint: "Capture whether monitors show Complete or Incomplete.",
    requiresPhotos: true,
    allowNotAccessible: true,
    noteRequiredWhen: "not_accessible_or_concern",
    requiredPhotoCount: 2,
  },

  // ── SECTION 8 — Field Summary ────────────────────────────────────────────
  {
    key: "field_summary",
    section: "Field Summary",
    sectionNumber: 8,
    title: "RideChecker Field Summary",
    whyItMatters: "Your summary is reviewed by the RideCheck team before any report is sent to the buyer.",
    instruction: "Summarize your findings, access limitations, and overall assessment for Ops. Do NOT tell the buyer whether to buy or not.",
    widePhotoLabel: "",
    widePhotoHint: "",
    closePhotoLabel: "",
    closePhotoHint: "",
    requiresPhotos: false,
    allowNotAccessible: false,
    noteRequiredWhen: "always",
    requiredPhotoCount: 0,
  },
];

export const STEP_KEYS   = INSPECTION_STEPS.map((s) => s.key);
export const TOTAL_STEPS = INSPECTION_STEPS.length;

export function getStep(key: string): InspectionStep | undefined {
  return INSPECTION_STEPS.find((s) => s.key === key);
}

export const SECTIONS = [
  "Identity & Paperwork",
  "Exterior & Body",
  "Tires & Wheels",
  "Interior & Electronics",
  "Engine Bay",
  "Underbody & Rust",
  "OBD / Diagnostic",
  "Field Summary",
] as const;

export type SectionName = typeof SECTIONS[number];

// ─────────────────────────────────────────────────────────────────────────────
// Step completion logic
// ─────────────────────────────────────────────────────────────────────────────

export function isStepComplete(step: InspectionStep, data: StepData | null | undefined): boolean {
  if (!data) return false;
  if (!data.answer) return false;

  if (step.key === "field_summary") {
    return !!data.answer && !!data.note?.trim();
  }

  if (step.requiresPhotos) {
    if (data.answer === "not_accessible") {
      return !!data.note?.trim();
    }
    if (!data.wide_photo_url?.trim() || !data.close_photo_url?.trim()) return false;
    if (data.answer === "concern" && !data.note?.trim()) return false;
    return true;
  }

  return !!data.answer;
}

/** Count uploaded photos for a step. */
export function stepPhotoCount(data: StepData | null | undefined): number {
  if (!data) return 0;
  let count = 0;
  if (data.wide_photo_url?.trim())  count++;
  if (data.close_photo_url?.trim()) count++;
  return count;
}

// ─────────────────────────────────────────────────────────────────────────────
// Section status
// ─────────────────────────────────────────────────────────────────────────────

export type SectionStatus = "not_started" | "in_progress" | "pass" | "concern" | "critical";

export function getSectionStatus(section: SectionName, stepData: Map<string, StepData>): SectionStatus {
  const steps = INSPECTION_STEPS.filter((s) => s.section === section);
  const allComplete = steps.every((s) => isStepComplete(s, stepData.get(s.key)));

  if (!allComplete) {
    const anyStarted = steps.some((s) => {
      const d = stepData.get(s.key);
      return d?.answer || d?.wide_photo_url || d?.close_photo_url;
    });
    return anyStarted ? "in_progress" : "not_started";
  }

  // All complete — derive status from answers
  const hasCritical = steps.some((s) => {
    const d = stepData.get(s.key);
    return d?.answer === "concern" && d.severity === "critical";
  });
  if (hasCritical) return "critical";

  const hasConcern = steps.some((s) => stepData.get(s.key)?.answer === "concern");
  if (hasConcern) return "concern";

  return "pass";
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface StepData {
  step_key: string;
  answer?: string | null;
  severity?: string | null;
  note?: string | null;
  wide_photo_url?: string | null;
  close_photo_url?: string | null;
  completed?: boolean;
  completed_at?: string | null;
}

export const ISSUE_TYPES = [
  { value: "unsafe_location",       label: "Unsafe Location",             hold: true  },
  { value: "hostile_seller",        label: "Hostile / Aggressive Seller", hold: false },
  { value: "vehicle_not_present",   label: "Vehicle Not Present",         hold: false },
  { value: "seller_refused_access", label: "Seller Refused Access",       hold: false },
  { value: "vin_mismatch",          label: "VIN Mismatch",                hold: true  },
  { value: "suspected_fraud",       label: "Suspected Fraud",             hold: true  },
  { value: "weather_delay",         label: "Weather Delay",               hold: false },
  { value: "police_issue",          label: "Police / Legal Issue",        hold: true  },
  { value: "other",                 label: "Other",                       hold: false },
] as const;
