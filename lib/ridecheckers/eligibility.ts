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
  workflow_stage?: string | null;
  is_active?: boolean | null;
  verification_status?: string | null;
  background_check_status?: string | null;
  documents_complete?: boolean | null;
  guide_completed?: boolean | null;
  training_sip4_completed?: boolean | null;
  agreement_status?: string | null;
  ridechecker_jobs_completed?: number | null;
  created_at?: string;
  approved_at?: string | null;
  invite_sent_at?: string | null;
  invite_accepted_at?: string | null;
  phone?: string | null;
  email?: string | null;
  service_area?: string | null;
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
      label: "Service area provided",
      status: profile.service_area ? "complete" : "missing",
      detail: profile.service_area || "No service area set",
      blocksDispatch: false,
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
      blocksDispatch: true,
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

  const blockedReasons: string[] = [];
  if (!isActive)                            blockedReasons.push("Account not active");
  if (idStatus !== "complete")              blockedReasons.push("ID verification not approved");
  if (bgStatus !== "complete")              blockedReasons.push("Background check not passed");
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
  } else if (bgStatus !== "complete") {
    nextAction = bgStatus === "pending" ? "Confirm background check result" : "Order background check";
  } else if (idStatus !== "complete") {
    nextAction = idStatus === "pending" ? "Review submitted ID" : "Request ID verification";
  }

  return { dispatchEligible, progressPercent, blockedReasons, nextAction, checklist };
}
