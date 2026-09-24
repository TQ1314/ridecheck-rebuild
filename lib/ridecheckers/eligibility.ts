/**
 * lib/ridecheckers/eligibility.ts
 *
 * Single source of truth for RideChecker dispatch eligibility.
 * Used in: RC Pipeline page, assignment modal, profile drawer.
 *
 * Keeps Active ≠ Dispatch Eligible separate:
 *   - Account Status: Active (workflow_stage ∈ [approved, active])
 *   - Dispatch Eligibility: requires agreement signed + background clear + training complete
 */
import { hasSignedCurrentAgreement } from "../agreements/rccpa-v1-2026-06";

export type EligibilityStatus = "complete" | "pending" | "missing" | "failed";

export interface EligibilityChecklistItem {
  key: string;
  label: string;
  status: EligibilityStatus;
  detail: string;
  blocksDispatch: boolean;
}

export interface RideCheckerEligibility {
  dispatchEligible: boolean;
  progressPercent: number;
  blockedReasons: string[];
  nextAction: string;
  checklist: EligibilityChecklistItem[];
}

export interface EligibilityProfile {
  id?: string;
  role?: string | null;
  availability_status?: string | null;
  is_available?: boolean | null;
  workflow_stage?: string | null;
  is_active?: boolean | null;
  verification_status?: string | null;
  background_check_status?: string | null;
  documents_complete?: boolean | null;
  guide_completed?: boolean | null;
  training_sip4_completed?: boolean | null;
  agreement_status?: string | null;
  current_agreement_version?: string | null;
  ridechecker_jobs_completed?: number | null;
  created_at?: string;
  approved_at?: string | null;
  invite_sent_at?: string | null;
  invite_accepted_at?: string | null;
  phone?: string | null;
  email?: string | null;
  service_area?: string | null;
  // Structured location fields (migration 061)
  rc_city?: string | null;
  rc_state?: string | null;
  rc_zip?: string | null;
  service_radius_miles?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  lat?: number | null;
  lng?: number | null;
  last_known_lat?: number | null;
  last_known_lng?: number | null;
}

export interface AssignmentLocation {
  latitude?: number | null;
  longitude?: number | null;
  lat?: number | null;
  lng?: number | null;
  last_known_lat?: number | null;
  last_known_lng?: number | null;
}

export interface AssignmentEligibilityContext {
  order?: AssignmentLocation | null;
  /** An explicit Ops Lead/Admin override is evaluated by the caller. */
  radiusOverride?: boolean;
}

export interface RideCheckerAssignmentEligibility {
  eligible: boolean;
  blockedReasons: string[];
  distanceMiles: number | null;
  radiusMiles: number | null;
  agreementGateActive: boolean;
}

function coordinates(value: AssignmentLocation | null | undefined): [number, number] | null {
  if (!value) return null;
  const latitude = value.latitude ?? value.lat ?? value.last_known_lat;
  const longitude = value.longitude ?? value.lng ?? value.last_known_lng;
  return typeof latitude === "number" && typeof longitude === "number"
    && Number.isFinite(latitude) && Number.isFinite(longitude)
    ? [latitude, longitude] : null;
}

function distanceInMiles(a: [number, number], b: [number, number]): number {
  const radians = (n: number) => n * Math.PI / 180;
  const dLat = radians(b[0] - a[0]);
  const dLon = radians(b[1] - a[1]);
  const x = Math.sin(dLat / 2) ** 2
    + Math.cos(radians(a[0])) * Math.cos(radians(b[0])) * Math.sin(dLon / 2) ** 2;
  return 3958.7613 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

/**
 * Canonical server-side gate for receiving or accepting an assignment.
 * Background checks are deliberately informational: current RideCheck policy
 * does not make them a dispatch blocker.
 */
export function getRideCheckerAssignmentEligibility(
  ridechecker: EligibilityProfile,
  context: AssignmentEligibilityContext = {},
): RideCheckerAssignmentEligibility {
  const blockedReasons: string[] = [];
  if (!["ridechecker", "ridechecker_active"].includes(ridechecker.role ?? "")) {
    blockedReasons.push("Profile is not a RideChecker");
  }
  const active = ridechecker.is_active === true
    && (!ridechecker.workflow_stage || ["approved", "active"].includes(ridechecker.workflow_stage));
  if (!active) blockedReasons.push("RideChecker account is not active and approved");

  const available = ridechecker.availability_status === "available"
    || (ridechecker.availability_status == null && ridechecker.is_available === true);
  if (!available) blockedReasons.push("RideChecker is not available");

  const agreementGateActive = ridechecker.agreement_status !== undefined
    || ridechecker.current_agreement_version !== undefined;
  if (agreementGateActive && !hasSignedCurrentAgreement(ridechecker)) {
    blockedReasons.push("Contractor agreement is not signed");
  }

  const rcLocation = coordinates(ridechecker);
  const orderLocation = coordinates(context.order);
  const radius = typeof ridechecker.service_radius_miles === "number"
    && ridechecker.service_radius_miles > 0 ? ridechecker.service_radius_miles : null;
  const distanceMiles = rcLocation && orderLocation ? distanceInMiles(rcLocation, orderLocation) : null;
  if (radius !== null && !context.radiusOverride) {
    if (distanceMiles === null) {
      blockedReasons.push("Cannot verify service radius: RideChecker and order locations are required");
    } else if (distanceMiles > radius) {
      blockedReasons.push(`Assignment is outside the ${radius}-mile service radius`);
    }
  }

  return {
    eligible: blockedReasons.length === 0,
    blockedReasons,
    distanceMiles,
    radiusMiles: radius,
    agreementGateActive,
  };
}

export function getRideCheckerEligibility(profile: EligibilityProfile): RideCheckerEligibility {
  const stage = profile.workflow_stage ?? "";
  const isTerminal = stage === "rejected" || stage === "suspended";
  const isActive = ["approved", "active"].includes(stage);

  const idStatus: EligibilityStatus =
    profile.verification_status === "active"    ? "complete" :
    profile.verification_status === "submitted" ? "pending"  :
    profile.verification_status === "rejected"  ? "failed"   : "missing";

  const bgStatus: EligibilityStatus =
    profile.background_check_status === "clear"   ? "complete" :
    profile.background_check_status === "pending" ? "pending"  :
    profile.background_check_status === "failed"  ? "failed"   : "missing";

  const trainingStatus: EligibilityStatus =
    (profile.guide_completed && profile.training_sip4_completed) ? "complete" :
    (profile.guide_completed || profile.training_sip4_completed) ? "pending"  : "missing";

  const agreementStatus: EligibilityStatus =
    profile.agreement_status === "signed" ? "complete" : "missing";

  const testRcStatus: EligibilityStatus =
    (profile.ridechecker_jobs_completed ?? 0) > 0 ? "complete" :
    isActive ? "pending" : "missing";

  const approvalStatus: EligibilityStatus =
    isActive                          ? "complete" :
    isTerminal                        ? "failed"   :
    stage === "ready_for_approval"    ? "pending"  : "missing";

  const checklist: EligibilityChecklistItem[] = [
    {
      key: "application",
      label: "Application submitted",
      status: "complete",
      detail: profile.created_at
        ? `Submitted ${new Date(profile.created_at).toLocaleDateString()}`
        : "Submitted",
      blocksDispatch: false,
    },
    {
      key: "phone",
      label: "Phone on file",
      status: profile.phone ? "complete" : "missing",
      detail: profile.phone ? "On file" : "No phone number",
      blocksDispatch: false,
    },
    {
      key: "email_verified",
      label: "Account activated",
      status: profile.invite_accepted_at ? "complete"
            : profile.invite_sent_at     ? "pending"
            : "missing",
      detail: profile.invite_accepted_at
        ? `Activated ${new Date(profile.invite_accepted_at).toLocaleDateString()}`
        : profile.invite_sent_at ? "Invite sent — awaiting activation"
        : "Invite not yet sent",
      blocksDispatch: false,
    },
    {
      key: "location",
      label: "Location on file",
      status: (profile.service_area || (profile.rc_city && profile.rc_state)) ? "complete" : "missing",
      detail: profile.rc_city && profile.rc_state
        ? `${profile.rc_city}, ${profile.rc_state}${profile.rc_zip ? ` ${profile.rc_zip}` : ""}${profile.service_radius_miles ? ` · ${profile.service_radius_miles} mi radius` : ""}`
        : profile.service_area || "No location set — required for dispatch",
      blocksDispatch: true,
    },
    {
      key: "id_verification",
      label: "ID verification approved",
      status: idStatus,
      detail: profile.verification_status === "active"    ? "Verified & approved"
            : profile.verification_status === "submitted" ? "Submitted — awaiting review"
            : profile.verification_status === "rejected"  ? "Rejected"
            : "Not submitted",
      blocksDispatch: true,
    },
    {
      key: "documents",
      label: "Documents complete",
      status: profile.documents_complete ? "complete" : "missing",
      detail: profile.documents_complete ? "All docs on file" : "Incomplete",
      blocksDispatch: false,
    },
    {
      key: "background",
      label: "Background check passed",
      status: bgStatus,
      detail: profile.background_check_status === "clear"   ? "Clear"
            : profile.background_check_status === "pending" ? "In progress"
            : profile.background_check_status === "failed"  ? "Failed"
            : "Not ordered",
      blocksDispatch: false,
    },
    {
      key: "training",
      label: "Training completed",
      status: trainingStatus,
      detail: (profile.guide_completed && profile.training_sip4_completed) ? "Guide + SIP-4 complete"
            : profile.guide_completed        ? "Guide ✓ — SIP-4 pending"
            : profile.training_sip4_completed? "SIP-4 ✓ — Guide pending"
            : "Not started",
      blocksDispatch: true,
    },
    {
      key: "agreement",
      label: "Contractor agreement signed",
      status: agreementStatus,
      detail: profile.agreement_status === "signed" ? "Current agreement signed" : "Not signed",
      blocksDispatch: true,
    },
    {
      key: "test_rc",
      label: "Test RideCheck completed",
      status: testRcStatus,
      detail: (profile.ridechecker_jobs_completed ?? 0) > 0
              ? `${profile.ridechecker_jobs_completed} job(s) completed`
              : isActive ? "Awaiting first assignment" : "Pending approval",
      blocksDispatch: false,
    },
    {
      key: "approval",
      label: "Final approval",
      status: approvalStatus,
      detail: isActive
              ? `Active${profile.approved_at ? ` since ${new Date(profile.approved_at).toLocaleDateString()}` : ""}`
              : isTerminal ? (stage === "rejected" ? "Application rejected" : "Account suspended")
              : stage === "ready_for_approval" ? "Awaiting ops approval"
              : "In pipeline",
      blocksDispatch: true,
    },
  ];

  const hasLocation = !!(profile.service_area || (profile.rc_city && profile.rc_state));

  const blockedReasons: string[] = [];
  if (!isActive)                            blockedReasons.push("Account not active");
  if (!hasLocation)                         blockedReasons.push("Location missing");
  if (idStatus !== "complete")              blockedReasons.push("ID verification not approved");
  if (trainingStatus !== "complete")        blockedReasons.push("Training incomplete");
  if (agreementStatus !== "complete")       blockedReasons.push("Contractor agreement not signed");
  if (isTerminal) {
    blockedReasons.push(stage === "rejected" ? "Application rejected" : "Account suspended");
  }

  const dispatchEligible = blockedReasons.length === 0;
  const completeCount = checklist.filter((c) => c.status === "complete").length;
  const progressPercent = Math.round((completeCount / checklist.length) * 100);

  let nextAction = "Dispatch eligible — no action required";
  if (isTerminal) {
    nextAction = stage === "suspended"
      ? "Review suspension before reactivating"
      : "Application closed — reinstate if appropriate";
  } else if (!isActive) {
    const firstPending = checklist.find((c) => c.status !== "complete" && c.status !== "failed");
    nextAction = firstPending ? `Complete: ${firstPending.label}` : "Advance to active status";
  } else if (agreementStatus !== "complete") {
    nextAction = "Send contractor agreement reminder";
  } else if (trainingStatus !== "complete") {
    nextAction = "Complete training modules";
  } else if (idStatus !== "complete") {
    nextAction = idStatus === "pending" ? "Review submitted ID" : "Request ID verification";
  }

  return { dispatchEligible, progressPercent, blockedReasons, nextAction, checklist };
}
