import { canProceedWithRideCheck } from "./payment-gate";

type Urgency = "high" | "medium" | "low" | "done";

interface NextAction {
  label: string;
  urgency: Urgency;
  link?: string;
}

export function computeNextAction(order: any): NextAction {
  const { id, status, assignment_status, payment_status } = order;
  const base = `/operations/orders/${id}`;

  if (status === "cancelled") return { label: "Cancelled", urgency: "done" };
  if (status === "completed") return { label: "Complete", urgency: "done" };
  if (status === "report_sent") return { label: "Report Sent", urgency: "done" };

  if (!canProceedWithRideCheck(order)) {
    if (payment_status === "failed") {
      return { label: "Payment Failed — Not Actionable", urgency: "high", link: base };
    }
    return { label: "PENDING PAYMENT — NOT ACTIONABLE", urgency: "low", link: base };
  }

  if (!assignment_status || assignment_status === "unassigned") {
    return { label: "Assign RideChecker", urgency: "high", link: base };
  }
  if (assignment_status === "awaiting_acceptance") {
    return { label: "Awaiting RC Accept", urgency: "medium", link: base };
  }
  if (assignment_status === "declined" || assignment_status === "expired") {
    return { label: "Reassign RideChecker", urgency: "high", link: base };
  }
  if (assignment_status === "accepted") {
    return { label: "Inspection Confirmed", urgency: "low", link: base };
  }
  if (status === "inspection_in_progress") {
    return { label: "Inspection Underway", urgency: "low", link: base };
  }
  if (status === "submitted" || status === "report_requested") {
    return { label: "Review Submission", urgency: "high", link: base };
  }
  if (status === "report_drafting") {
    return { label: "Generate Report", urgency: "medium", link: base };
  }
  if (status === "report_ready") {
    return { label: "Send to Buyer", urgency: "high", link: base };
  }
  return { label: "Review Order", urgency: "medium", link: base };
}