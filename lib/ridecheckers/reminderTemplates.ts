/**
 * lib/ridecheckers/reminderTemplates.ts
 *
 * Targeted reminder templates sent to RideCheckers when specific
 * eligibility requirements are blocking them from receiving jobs.
 *
 * pickTemplate() selects the highest-priority template based on
 * the RC's current eligibility gaps.
 */

import { getRideCheckerEligibility, type EligibilityProfile } from "./eligibility";

export type ReminderTemplateKey =
  | "location"
  | "agreement"
  | "background"
  | "training"
  | "one_step_away";

export interface ReminderTemplate {
  key: ReminderTemplateKey;
  subject: string;
  emailHtml: (name: string, dashboardUrl: string, detail?: string) => string;
  smsBody: (name: string, dashboardUrl: string, detail?: string) => string;
  label: string;
  description: string;
}

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://www.ridecheckauto.com";
const DASHBOARD = `${BASE_URL}/ridechecker/dashboard`;

function emailWrapper(name: string, heading: string, body: string): string {
  return `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#111">
  <h2 style="color:#1a6b3c;margin-bottom:4px">RideCheck</h2>
  <p style="font-size:15px">Hi ${name},</p>
  <p style="font-size:15px;font-weight:600;color:#111">${heading}</p>
  ${body}
  <p style="font-size:14px;color:#374151">— The RideCheck Operations Team</p>
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0"/>
  <p style="font-size:11px;color:#9ca3af">You're receiving this because you're a registered RideChecker. Reply to this email if you have questions.</p>
</div>`.trim();
}

export const REMINDER_TEMPLATES: Record<ReminderTemplateKey, ReminderTemplate> = {
  location: {
    key: "location",
    label: "Location Information Missing",
    description: "RC hasn't set a service area — we can't match them to nearby jobs",
    subject: "Action Needed: Add Your Service Area to Start Receiving Jobs",
    emailHtml: (name, url) => emailWrapper(
      name,
      "We don't have your location on file.",
      `<p style="font-size:14px;color:#374151">Without a service area, we can't match you with nearby jobs. It takes less than a minute to add it — just log in to your dashboard and update your profile.</p>
       <p><a href="${url}" style="display:inline-block;background:#1a6b3c;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:600">Update My Location →</a></p>`
    ),
    smsBody: (name, url) =>
      `RideCheck: Hi ${name}, we're missing your service area — without it we can't send you jobs. Add it here: ${url}`,
  },

  agreement: {
    key: "agreement",
    label: "Contractor Agreement Reminder",
    description: "RC hasn't signed the current contractor agreement",
    subject: "Action Required: Sign Your Contractor Agreement",
    emailHtml: (name, url) => emailWrapper(
      name,
      "Your contractor agreement is unsigned.",
      `<p style="font-size:14px;color:#374151">Signing the RideCheck Contractor Agreement is required before we can assign you any jobs. It's a quick read — please sign it now so we can get you on the schedule.</p>
       <p><a href="${url}" style="display:inline-block;background:#1a6b3c;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:600">Sign My Agreement →</a></p>`
    ),
    smsBody: (name, url) =>
      `RideCheck: Hi ${name}, your contractor agreement still needs to be signed before we can assign you jobs. Sign it here: ${url}`,
  },

  background: {
    key: "background",
    label: "Background Check Required",
    description: "Background check not yet ordered or still pending",
    subject: "Background Check Status — Action May Be Required",
    emailHtml: (name, url, detail) => emailWrapper(
      name,
      "Your background check needs attention.",
      `<p style="font-size:14px;color:#374151">${
        detail === "pending"
          ? "Your background check is currently in progress. We'll notify you as soon as it clears. No action needed right now — just hang tight."
          : "We haven't started your background check yet, which is a required step before you can be dispatched. Please reach out to us or check your dashboard so we can get this moving."
      }</p>
       <p><a href="${url}" style="display:inline-block;background:#1a6b3c;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:600">View My Dashboard →</a></p>`
    ),
    smsBody: (name, url, detail) =>
      detail === "pending"
        ? `RideCheck: Hi ${name}, your background check is in progress — we'll notify you when it clears. Questions? Visit ${url}`
        : `RideCheck: Hi ${name}, your background check hasn't been started yet. This is required before we can assign you jobs. Visit ${url} or reply to this message.`,
  },

  training: {
    key: "training",
    label: "Training Incomplete",
    description: "RC hasn't completed all required training modules",
    subject: "Complete Your Training to Start Receiving Jobs",
    emailHtml: (name, url, detail) => emailWrapper(
      name,
      "You have unfinished training.",
      `<p style="font-size:14px;color:#374151">Completing your training is required before you can be dispatched to jobs.${
        detail ? ` You still need to finish: <strong>${detail}</strong>.` : ""
      } Log in to your dashboard to complete it — it's the last step between you and your first job.</p>
       <p><a href="${url}" style="display:inline-block;background:#1a6b3c;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:600">Complete My Training →</a></p>`
    ),
    smsBody: (name, url, detail) =>
      `RideCheck: Hi ${name}, you're almost ready! ${detail ? `Just finish: ${detail}. ` : ""}Complete your training to start getting jobs: ${url}`,
  },

  one_step_away: {
    key: "one_step_away",
    label: "You're One Step Away From Eligibility",
    description: "Only one dispatch blocker remains — give them a nudge",
    subject: "You're Almost There — One Step Left to Receive Jobs",
    emailHtml: (name, url, detail) => emailWrapper(
      name,
      "You're one step away from receiving jobs.",
      `<p style="font-size:14px;color:#374151">Great progress! You've completed almost everything required to be dispatched. The only thing left is:</p>
       <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:12px 16px;margin:12px 0">
         <p style="font-size:14px;font-weight:600;color:#166534;margin:0">→ ${detail ?? "One remaining step"}</p>
       </div>
       <p style="font-size:14px;color:#374151">Take care of it and you'll be on the dispatch list immediately.</p>
       <p><a href="${url}" style="display:inline-block;background:#1a6b3c;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:600">Finish Up →</a></p>`
    ),
    smsBody: (name, url, detail) =>
      `RideCheck: Hi ${name}, you're one step away from receiving jobs! Just ${detail ?? "one remaining step"} — complete it here: ${url}`,
  },
};

// ─── Template picker ──────────────────────────────────────────────────────────

export interface PickedTemplate {
  template: ReminderTemplate;
  detail?: string;
}

/**
 * Selects the best targeted reminder for an RC based on their eligibility gaps.
 * Returns null if the RC is already dispatch-eligible (no reminder needed).
 *
 * Priority order:
 *   1. one_step_away  — only 1 dispatch-blocking item remains (most motivating)
 *   2. background     — unordered/pending check (hardest to self-resolve)
 *   3. agreement      — unsigned agreement
 *   4. training       — incomplete modules
 *   5. location       — no service area
 */
export function pickTemplate(profile: EligibilityProfile): PickedTemplate | null {
  const eligibility = getRideCheckerEligibility(profile);

  if (eligibility.dispatchEligible) return null;

  const checklist = eligibility.checklist;
  const blocking = checklist.filter((c) => c.blocksDispatch && c.status !== "complete" && c.status !== "failed");

  if (blocking.length === 0) return null;

  // one_step_away — only 1 dispatch-blocking gap left
  if (blocking.length === 1) {
    return {
      template: REMINDER_TEMPLATES.one_step_away,
      detail: blocking[0].label,
    };
  }

  // background
  const bg = checklist.find((c) => c.key === "background");
  if (bg && bg.status !== "complete" && bg.status !== "failed") {
    return {
      template: REMINDER_TEMPLATES.background,
      detail: bg.status === "pending" ? "pending" : undefined,
    };
  }

  // agreement
  const ag = checklist.find((c) => c.key === "agreement");
  if (ag && ag.status !== "complete") {
    return { template: REMINDER_TEMPLATES.agreement };
  }

  // training
  const tr = checklist.find((c) => c.key === "training");
  if (tr && tr.status !== "complete") {
    const guideOk = profile.guide_completed;
    const sipOk   = profile.training_sip4_completed;
    const detail  = !guideOk && !sipOk ? "Operations Guide + SIP-4 module"
                  : !guideOk           ? "Operations Guide"
                  :                      "SIP-4 module";
    return { template: REMINDER_TEMPLATES.training, detail };
  }

  // location (doesn't block dispatch but impedes matching)
  if (!profile.service_area) {
    return { template: REMINDER_TEMPLATES.location };
  }

  return null;
}

export const DEDUP_DAYS = 3;
export const DASHBOARD_URL = DASHBOARD;
