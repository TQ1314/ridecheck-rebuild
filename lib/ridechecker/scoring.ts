import "server-only";
import type { RideCheckerRawSubmission } from "@/types/orders";

const MIN_TEXT_LENGTH = 15;

interface ScoringInput {
  submission: RideCheckerRawSubmission;
  scheduledEnd?: string | null;
}

interface ScoringResult {
  total: number;
  checklistScore: number;
  photoScore: number;
  textScore: number;
  timelinessScore: number;
  breakdown: Record<string, any>;
}

export function scoreSubmission(input: ScoringInput): ScoringResult {
  const { submission, scheduledEnd } = input;
  const breakdown: Record<string, any> = {};

  const checklistScore = scoreChecklist(submission, breakdown);
  const photoScore = scorePhotos(submission, breakdown);
  const textScore = scoreText(submission, breakdown);
  const timelinessScore = scoreTimeliness(submission.submitted_at, scheduledEnd, breakdown);

  const total = checklistScore + photoScore + textScore + timelinessScore;

  return {
    total: Math.round(total * 100) / 100,
    checklistScore,
    photoScore,
    textScore,
    timelinessScore,
    breakdown,
  };
}

function scoreChecklist(sub: RideCheckerRawSubmission, breakdown: Record<string, any>): number {
  const requiredFields = [
    { key: "vin_photo_url", val: sub.vin_photo_url },
    { key: "odometer_photo_url", val: sub.odometer_photo_url },
    { key: "under_hood_photo_url", val: sub.under_hood_photo_url },
    { key: "undercarriage_photo_url", val: sub.undercarriage_photo_url },
    { key: "cosmetic_exterior", val: sub.cosmetic_exterior },
    { key: "interior_condition", val: sub.interior_condition },
    { key: "mechanical_issues", val: sub.mechanical_issues },
    { key: "test_drive_notes", val: sub.test_drive_notes },
    { key: "immediate_concerns", val: sub.immediate_concerns },
  ];

  const present = requiredFields.filter((f) => f.val && f.val.trim().length > 0);
  const missing = requiredFields.filter((f) => !f.val || f.val.trim().length === 0).map((f) => f.key);

  const ratio = present.length / requiredFields.length;
  const score = Math.round(ratio * 40 * 100) / 100;

  breakdown.checklist = {
    present: present.length,
    total: requiredFields.length,
    missing,
    score,
  };

  return score;
}

function scorePhotos(sub: RideCheckerRawSubmission, breakdown: Record<string, any>): number {
  const requiredPhotos = [
    sub.vin_photo_url,
    sub.odometer_photo_url,
    sub.under_hood_photo_url,
    sub.undercarriage_photo_url,
  ];

  const requiredPresent = requiredPhotos.filter((p) => p && p.trim().length > 0).length;
  const baseScore = (requiredPresent / 4) * 15;

  const extraCount = Array.isArray(sub.extra_photos) ? sub.extra_photos.length : 0;
  const bonusScore = Math.min(extraCount, 5);

  const score = Math.round((baseScore + bonusScore) * 100) / 100;

  breakdown.photos = {
    requiredPresent,
    requiredTotal: 4,
    extraCount,
    score,
  };

  return score;
}

function scoreText(sub: RideCheckerRawSubmission, breakdown: Record<string, any>): number {
  const sections = [
    { key: "cosmetic_exterior", val: sub.cosmetic_exterior },
    { key: "interior_condition", val: sub.interior_condition },
    { key: "mechanical_issues", val: sub.mechanical_issues },
    { key: "test_drive_notes", val: sub.test_drive_notes },
    { key: "immediate_concerns", val: sub.immediate_concerns },
  ];

  let pointsEarned = 0;
  const details: Record<string, any> = {};

  for (const section of sections) {
    const len = section.val?.trim().length || 0;
    const meetsMin = len >= MIN_TEXT_LENGTH;
    const sectionScore = meetsMin ? 4 : Math.round((len / MIN_TEXT_LENGTH) * 4 * 100) / 100;
    pointsEarned += sectionScore;
    details[section.key] = { length: len, meetsMin, score: sectionScore };
  }

  breakdown.text = { details, score: pointsEarned };
  return Math.round(pointsEarned * 100) / 100;
}

function scoreTimeliness(
  submittedAt: string,
  scheduledEnd?: string | null,
  breakdown?: Record<string, any>
): number {
  if (!scheduledEnd) {
    if (breakdown) breakdown.timeliness = { note: "no_scheduled_end", score: 15 };
    return 15;
  }

  const submitted = new Date(submittedAt).getTime();
  const deadline = new Date(scheduledEnd).getTime();
  const hoursAfter = (submitted - deadline) / (1000 * 60 * 60);

  let score: number;
  if (hoursAfter <= 0) {
    score = 20;
  } else if (hoursAfter <= 2) {
    score = 18;
  } else if (hoursAfter <= 6) {
    score = 14;
  } else if (hoursAfter <= 24) {
    score = 8;
  } else {
    score = 4;
  }

  if (breakdown) {
    breakdown.timeliness = { hoursAfterDeadline: Math.round(hoursAfter * 100) / 100, score };
  }

  return score;
}

export function isChecklistComplete(sub: Partial<RideCheckerRawSubmission>): boolean {
  return !!(
    sub.vin_photo_url?.trim() &&
    sub.odometer_photo_url?.trim() &&
    sub.under_hood_photo_url?.trim() &&
    sub.undercarriage_photo_url?.trim() &&
    sub.cosmetic_exterior?.trim() &&
    sub.interior_condition?.trim() &&
    sub.mechanical_issues?.trim() &&
    sub.test_drive_notes?.trim() &&
    sub.immediate_concerns?.trim()
  );
}
