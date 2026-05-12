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
  requiresPhotos: boolean;        // false only for the summary step
  allowNotAccessible: boolean;    // whether "Not Accessible" is a valid answer
  noteRequiredWhen: "always" | "concern" | "not_accessible_or_concern" | "never";
}

export const INSPECTION_STEPS: InspectionStep[] = [
  // ── SECTION 1 — Identity & Paperwork ────────────────────────────────────
  {
    key: "vin_dashboard",
    section: "Identity & Paperwork",
    sectionNumber: 1,
    title: "VIN — Windshield / Dashboard",
    whyItMatters: "The VIN confirms the vehicle's identity. A mismatch is a serious red flag.",
    instruction: "Photograph the VIN plate visible through the lower-left area of the windshield from outside, then a close-up of the VIN characters.",
    widePhotoLabel: "Wide — Windshield area",
    widePhotoHint: "Step back 2–3 feet. Capture the full front windshield so the VIN area is visible.",
    closePhotoLabel: "Close — VIN plate",
    closePhotoHint: "All 17 characters must be legible. No glare or shadows.",
    requiresPhotos: true,
    allowNotAccessible: false,
    noteRequiredWhen: "concern",
  },
  {
    key: "odometer",
    section: "Identity & Paperwork",
    sectionNumber: 1,
    title: "Odometer Reading",
    whyItMatters: "Odometer fraud is common. A clear photo timestamps the actual mileage.",
    instruction: "Turn the ignition to the ON position (engine does not need to run). Photograph the full dashboard and a close-up of the odometer mileage.",
    widePhotoLabel: "Wide — Full dashboard",
    widePhotoHint: "Capture the entire gauge cluster with all visible warning lights.",
    closePhotoLabel: "Close — Odometer",
    closePhotoHint: "Mileage must be clearly readable. Include any warning lights.",
    requiresPhotos: true,
    allowNotAccessible: false,
    noteRequiredWhen: "concern",
  },
  {
    key: "title_paperwork",
    section: "Identity & Paperwork",
    sectionNumber: 1,
    title: "Title / Paperwork",
    whyItMatters: "Title issues, salvage branding, or liens are hidden from online listings.",
    instruction: "If the seller allows, photograph the title or any available paperwork. Avoid capturing private information beyond the VIN and title status area.",
    widePhotoLabel: "Wide — Document context",
    widePhotoHint: "Show the document on a flat surface.",
    closePhotoLabel: "Close — VIN / title status",
    closePhotoHint: "Capture the VIN line and any branding status (salvage, rebuilt, etc.).",
    requiresPhotos: true,
    allowNotAccessible: true,
    noteRequiredWhen: "not_accessible_or_concern",
  },

  // ── SECTION 2 — Exterior & Body ──────────────────────────────────────────
  {
    key: "exterior_front",
    section: "Exterior & Body",
    sectionNumber: 2,
    title: "Front Exterior",
    whyItMatters: "Front-end damage often indicates past collisions that may not be disclosed.",
    instruction: "Stand 6–8 feet in front of the vehicle. Take a wide 3/4 angle shot, then close-ups of the front bumper, grille, and headlights.",
    widePhotoLabel: "Wide — Full front 3/4 angle",
    widePhotoHint: "Capture bumper to roof, full width of the front.",
    closePhotoLabel: "Close — Bumper / headlights",
    closePhotoHint: "Focus on any damage, cracks, paint mismatch, or misalignment.",
    requiresPhotos: true,
    allowNotAccessible: false,
    noteRequiredWhen: "concern",
  },
  {
    key: "exterior_rear",
    section: "Exterior & Body",
    sectionNumber: 2,
    title: "Rear Exterior",
    whyItMatters: "Rear collision damage and rust are common undisclosed issues.",
    instruction: "Stand 6–8 feet behind the vehicle. Take a wide 3/4 rear angle, then a close-up of the rear bumper, trunk, or tailgate area.",
    widePhotoLabel: "Wide — Full rear 3/4 angle",
    widePhotoHint: "Capture from bumper to roof, full rear width.",
    closePhotoLabel: "Close — Bumper / tailgate area",
    closePhotoHint: "Note any cracking, paint fade, damage, or misalignment.",
    requiresPhotos: true,
    allowNotAccessible: false,
    noteRequiredWhen: "concern",
  },
  {
    key: "exterior_driver_side",
    section: "Exterior & Body",
    sectionNumber: 2,
    title: "Driver Side Exterior",
    whyItMatters: "Door dings, rocker panel rust, and paint repairs are most common on the driver side.",
    instruction: "Stand perpendicular to the driver side. Take a full-length side shot, then crouch down for a close-up of the rocker panel and lower door area.",
    widePhotoLabel: "Wide — Full driver side",
    widePhotoHint: "Full length from front to rear wheel, ground to roofline.",
    closePhotoLabel: "Close — Rocker panel / lower door",
    closePhotoHint: "Look for rust, dents, repair patches, or paint bubbling.",
    requiresPhotos: true,
    allowNotAccessible: false,
    noteRequiredWhen: "concern",
  },
  {
    key: "exterior_passenger_side",
    section: "Exterior & Body",
    sectionNumber: 2,
    title: "Passenger Side Exterior",
    whyItMatters: "Curb rash and unreported panel repairs are frequently on the passenger side.",
    instruction: "Mirror the driver side process. Full-length side shot, then close-up of the rocker panel and lower doors.",
    widePhotoLabel: "Wide — Full passenger side",
    widePhotoHint: "Full length from front to rear wheel, ground to roofline.",
    closePhotoLabel: "Close — Rocker panel / lower door",
    closePhotoHint: "Look for rust, dents, curb rash, or mismatched paint.",
    requiresPhotos: true,
    allowNotAccessible: false,
    noteRequiredWhen: "concern",
  },
  {
    key: "body_damage",
    section: "Exterior & Body",
    sectionNumber: 2,
    title: "Rust / Body Damage",
    whyItMatters: "Rust and unrepaired body damage affect structural integrity and resale value.",
    instruction: "Walk around the entire vehicle looking for rust, dents, mismatched paint, panel gaps, or accident evidence. Photograph the worst area found.",
    widePhotoLabel: "Wide — Location context",
    widePhotoHint: "Show which part of the car and its surroundings.",
    closePhotoLabel: "Close — Damage detail",
    closePhotoHint: "Get close to show rust depth, dent size, or paint issue clearly.",
    requiresPhotos: true,
    allowNotAccessible: true,
    noteRequiredWhen: "not_accessible_or_concern",
  },

  // ── SECTION 3 — Tires & Wheels ───────────────────────────────────────────
  {
    key: "tires_front",
    section: "Tires & Wheels",
    sectionNumber: 3,
    title: "Front Tire Condition",
    whyItMatters: "Worn or mismatched tires are a safety issue and indicate vehicle neglect.",
    instruction: "Photograph both front tires. Wide shot of the full wheel, then a close-up showing tread depth, sidewall condition, and the DOT date code if visible.",
    widePhotoLabel: "Wide — Full front wheel/tire",
    widePhotoHint: "Capture the whole wheel including rim from the side.",
    closePhotoLabel: "Close — Tread / sidewall",
    closePhotoHint: "Show tread grooves, any cracking, bulges, or uneven wear. Include date code if visible.",
    requiresPhotos: true,
    allowNotAccessible: false,
    noteRequiredWhen: "concern",
  },
  {
    key: "tires_rear",
    section: "Tires & Wheels",
    sectionNumber: 3,
    title: "Rear Tire Condition",
    whyItMatters: "Rear tire wear patterns reveal alignment and suspension issues.",
    instruction: "Same process as front tires. Photograph both rear tires.",
    widePhotoLabel: "Wide — Full rear wheel/tire",
    widePhotoHint: "Capture the whole wheel including rim from the side.",
    closePhotoLabel: "Close — Tread / sidewall",
    closePhotoHint: "Show tread grooves, any cracking, bulges, or uneven wear.",
    requiresPhotos: true,
    allowNotAccessible: false,
    noteRequiredWhen: "concern",
  },

  // ── SECTION 4 — Interior & Electronics ──────────────────────────────────
  {
    key: "interior_driver",
    section: "Interior & Electronics",
    sectionNumber: 4,
    title: "Driver Seat & Interior",
    whyItMatters: "Interior wear reveals real-world usage vs. disclosed mileage and condition.",
    instruction: "Open the driver door. Take a wide shot of the full front interior, then a close-up of the driver seat bolster, pedals, and the most worn area.",
    widePhotoLabel: "Wide — Full front interior",
    widePhotoHint: "Capture seats, dashboard, center console, and headliner.",
    closePhotoLabel: "Close — Driver seat / pedals / wear",
    closePhotoHint: "Focus on the driver seat bolster, pedal wear, and floor mat condition.",
    requiresPhotos: true,
    allowNotAccessible: false,
    noteRequiredWhen: "concern",
  },
  {
    key: "dashboard_warning_lights",
    section: "Interior & Electronics",
    sectionNumber: 4,
    title: "Dashboard Warning Lights",
    whyItMatters: "Warning lights indicate mechanical issues that may be hidden from buyers.",
    instruction: "With ignition ON (engine running if possible), photograph the full dashboard and a close-up of the warning light cluster.",
    widePhotoLabel: "Wide — Full dashboard",
    widePhotoHint: "Capture from steering column to infotainment screen.",
    closePhotoLabel: "Close — Warning light cluster",
    closePhotoHint: "Focus on the instrument cluster. Any illuminated warning lights must be visible.",
    requiresPhotos: true,
    allowNotAccessible: false,
    noteRequiredWhen: "concern",
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
    closePhotoLabel: "Close — Any failed control or warning",
    closePhotoHint: "Photograph any switch that does not work or any warning indicator.",
    requiresPhotos: true,
    allowNotAccessible: true,
    noteRequiredWhen: "not_accessible_or_concern",
  },

  // ── SECTION 5 — Engine Bay ───────────────────────────────────────────────
  {
    key: "engine_bay_overview",
    section: "Engine Bay",
    sectionNumber: 5,
    title: "Engine Bay Overview",
    whyItMatters: "A clean engine bay can hide recent resprays; a messy one reveals neglect or leaks.",
    instruction: "Open the hood fully. Stand above the open hood and photograph the entire engine bay, then zoom in on any area of concern.",
    widePhotoLabel: "Wide — Full engine bay",
    widePhotoHint: "Capture the entire engine compartment from above.",
    closePhotoLabel: "Close — Concern area / general detail",
    closePhotoHint: "If everything looks fine, focus on the engine top or an area that shows its condition best.",
    requiresPhotos: true,
    allowNotAccessible: false,
    noteRequiredWhen: "concern",
  },
  {
    key: "oil_dipstick",
    section: "Engine Bay",
    sectionNumber: 5,
    title: "Oil Cap & Dipstick",
    whyItMatters: "Oil condition and color reveal engine health and maintenance history.",
    instruction: "If safe and accessible, remove the oil dipstick and photograph it alongside the oil cap underside. Dark oil, milky residue, or a gritty cap are red flags.",
    widePhotoLabel: "Wide — Oil cap/dipstick location",
    widePhotoHint: "Show where in the engine bay the oil cap is located.",
    closePhotoLabel: "Close — Dipstick or cap underside",
    closePhotoHint: "Show oil color and any residue or milkiness.",
    requiresPhotos: true,
    allowNotAccessible: true,
    noteRequiredWhen: "not_accessible_or_concern",
  },
  {
    key: "fluids_leaks",
    section: "Engine Bay",
    sectionNumber: 5,
    title: "Fluids & Visible Leaks",
    whyItMatters: "Active leaks indicate mechanical issues that are expensive to repair.",
    instruction: "Inspect the lower engine bay area and the ground under the car for fluid stains or active drips. Photograph the engine underside and any stains.",
    widePhotoLabel: "Wide — Lower engine bay",
    widePhotoHint: "Show the bottom of the engine and any visible drips or staining.",
    closePhotoLabel: "Close — Leak or stain detail",
    closePhotoHint: "If clean, photograph the area under the engine on the ground. If a leak is present, get close to show the source.",
    requiresPhotos: true,
    allowNotAccessible: false,
    noteRequiredWhen: "concern",
  },

  // ── SECTION 6 — Underbody ────────────────────────────────────────────────
  {
    key: "underbody_front",
    section: "Underbody & Rust",
    sectionNumber: 6,
    title: "Front Underbody",
    whyItMatters: "Frame rust, bent subframe, and suspension damage are invisible from the outside.",
    instruction: "Crouch at the front bumper and angle your phone under the car. Capture the front frame rails, suspension components, and any visible fluid traces.",
    widePhotoLabel: "Wide — Front underside",
    widePhotoHint: "Shoot under the car from front, angled toward the rear.",
    closePhotoLabel: "Close — Rust / leak / suspension",
    closePhotoHint: "Focus on any rust scale, bent metal, leaking CV boots, or damaged bushings.",
    requiresPhotos: true,
    allowNotAccessible: false,
    noteRequiredWhen: "concern",
  },
  {
    key: "underbody_rear",
    section: "Underbody & Rust",
    sectionNumber: 6,
    title: "Rear Underbody",
    whyItMatters: "Exhaust condition, rear axle/suspension, and fuel lines are all visible here.",
    instruction: "Move to the rear of the vehicle. Angle the phone under to capture the rear frame, exhaust system, rear suspension, and muffler.",
    widePhotoLabel: "Wide — Rear underside",
    widePhotoHint: "Shoot under the car from the rear, angled toward the front.",
    closePhotoLabel: "Close — Rust / exhaust / suspension",
    closePhotoHint: "Look for rust holes, cracked exhaust, oil on the axle, or damaged mounts.",
    requiresPhotos: true,
    allowNotAccessible: false,
    noteRequiredWhen: "concern",
  },

  // ── SECTION 7 — OBD / Diagnostic ────────────────────────────────────────
  {
    key: "obd_scan",
    section: "OBD / Diagnostic",
    sectionNumber: 7,
    title: "OBD-II Scan Result",
    whyItMatters: "Stored fault codes reveal problems that have been intentionally cleared before sale.",
    instruction: "Plug your OBD-II scanner into the port (under the dash, driver's side). Photograph the scanner connected, then the results screen showing all codes.",
    widePhotoLabel: "Wide — Scanner connected to port",
    widePhotoHint: "Show the scanner plugged into the OBD port.",
    closePhotoLabel: "Close — Results screen",
    closePhotoHint: "Capture all code listings. Include cleared/pending codes if visible.",
    requiresPhotos: true,
    allowNotAccessible: true,
    noteRequiredWhen: "not_accessible_or_concern",
  },
  {
    key: "obd_readiness",
    section: "OBD / Diagnostic",
    sectionNumber: 7,
    title: "Readiness Monitors",
    whyItMatters: "Incomplete readiness monitors indicate codes were recently cleared — a common dealer trick.",
    instruction: "While the scanner is still connected, navigate to the 'Readiness' or 'I/M Monitors' screen. Photograph the readiness status for all monitors.",
    widePhotoLabel: "Wide — Scanner / app screen",
    widePhotoHint: "Show the full screen of your scanner app.",
    closePhotoLabel: "Close — Readiness status",
    closePhotoHint: "Capture whether monitors show 'Complete' or 'Incomplete'.",
    requiresPhotos: true,
    allowNotAccessible: true,
    noteRequiredWhen: "not_accessible_or_concern",
  },

  // ── SECTION 8 — Final Summary ────────────────────────────────────────────
  {
    key: "field_summary",
    section: "Field Summary",
    sectionNumber: 8,
    title: "RideChecker Field Summary",
    whyItMatters: "Your summary is reviewed by the RideCheck team before any report is sent to the buyer.",
    instruction: "Summarize your findings, any access limitations, and give your overall assessment for the Ops team. Do NOT tell the buyer whether to buy or not.",
    widePhotoLabel: "",
    widePhotoHint: "",
    closePhotoLabel: "",
    closePhotoHint: "",
    requiresPhotos: false,
    allowNotAccessible: false,
    noteRequiredWhen: "always",
  },
];

export const STEP_KEYS = INSPECTION_STEPS.map((s) => s.key);
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

// Steps where any answer (including not_accessible) makes them "complete"
export function isStepComplete(step: InspectionStep, data: StepData | null | undefined): boolean {
  if (!data) return false;
  if (!data.answer) return false;

  if (step.key === "field_summary") {
    // Summary: need answer + note
    return !!data.answer && !!data.note?.trim();
  }

  if (step.requiresPhotos) {
    if (data.answer === "not_accessible") {
      // Not accessible: need a note explaining why
      return !!data.note?.trim();
    }
    // For pass/concern: need both photos
    if (!data.wide_photo_url?.trim() || !data.close_photo_url?.trim()) return false;
    // Concern needs a note
    if (data.answer === "concern" && !data.note?.trim()) return false;
    return true;
  }

  return !!data.answer;
}

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
  { value: "unsafe_location",     label: "Unsafe Location",          hold: true },
  { value: "hostile_seller",      label: "Hostile / Aggressive Seller", hold: false },
  { value: "vehicle_not_present", label: "Vehicle Not Present",      hold: false },
  { value: "seller_refused_access", label: "Seller Refused Access",  hold: false },
  { value: "vin_mismatch",        label: "VIN Mismatch",             hold: true },
  { value: "suspected_fraud",     label: "Suspected Fraud",          hold: true },
  { value: "weather_delay",       label: "Weather Delay",            hold: false },
  { value: "police_issue",        label: "Police / Legal Issue",     hold: true },
  { value: "other",               label: "Other",                    hold: false },
] as const;
