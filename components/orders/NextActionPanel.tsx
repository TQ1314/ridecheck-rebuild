"use client";

import type { Order } from "@/types/orders";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  Clock,
  CheckCircle2,
  ArrowRight,
  CalendarClock,
} from "lucide-react";
import { differenceInDays, parseISO, isToday, isPast, startOfDay } from "date-fns";

interface NextActionPanelProps {
  order: Order;
  attemptCount: number;
}

type Urgency = "overdue" | "due_today" | "normal" | "complete";

function getOverdueInfo(preferredDate: string | null, status: string): {
  urgency: Urgency;
  daysOverdue: number;
} {
  const terminalStatuses = ["completed", "delivered", "cancelled"];
  if (!preferredDate || terminalStatuses.includes(status)) {
    return { urgency: terminalStatuses.includes(status) ? "complete" : "normal", daysOverdue: 0 };
  }

  let date: Date;
  try {
    date = parseISO(preferredDate);
  } catch {
    return { urgency: "normal", daysOverdue: 0 };
  }

  const today = startOfDay(new Date());
  const inspectionDay = startOfDay(date);

  if (isPast(inspectionDay) && !isToday(inspectionDay)) {
    const days = differenceInDays(today, inspectionDay);
    return { urgency: "overdue", daysOverdue: days };
  }
  if (isToday(inspectionDay)) {
    return { urgency: "due_today", daysOverdue: 0 };
  }
  return { urgency: "normal", daysOverdue: 0 };
}

function getNextAction(order: Order, attemptCount: number): { icon: React.ReactNode; text: string; sub?: string } {
  const isConcierge = order.booking_type === "concierge";
  const contactStatus = order.seller_contact_status;

  if (order.payment_status !== "paid") {
    return {
      icon: <ArrowRight className="h-4 w-4" />,
      text: "Awaiting payment",
      sub: "Send payment link to buyer before proceeding",
    };
  }

  if (isConcierge) {
    if (!contactStatus || contactStatus === "not_started") {
      return {
        icon: <ArrowRight className="h-4 w-4" />,
        text: "Contact seller",
        sub: "Concierge order — reach out to seller to arrange inspection",
      };
    }
    if (contactStatus === "attempting") {
      if (attemptCount < 3) {
        return {
          icon: <ArrowRight className="h-4 w-4" />,
          text: `Continue seller outreach (${attemptCount}/3 attempts)`,
          sub: "Log at least 3 attempts before marking No Response",
        };
      }
      return {
        icon: <ArrowRight className="h-4 w-4" />,
        text: "3 attempts done — set outcome",
        sub: "Mark Accepted, Declined, No Response, or Invalid Contact",
      };
    }
    if (contactStatus === "no_response") {
      return {
        icon: <ArrowRight className="h-4 w-4" />,
        text: "No response — contact buyer",
        sub: "Notify buyer that seller did not respond",
      };
    }
    if (contactStatus === "declined") {
      return {
        icon: <ArrowRight className="h-4 w-4" />,
        text: "Seller declined — contact buyer",
        sub: "Let buyer know and discuss next steps",
      };
    }
    if (contactStatus === "invalid_contact") {
      return {
        icon: <ArrowRight className="h-4 w-4" />,
        text: "Invalid contact info — verify with buyer",
        sub: "Ask buyer to provide updated seller contact details",
      };
    }
  }

  if (contactStatus === "accepted" || !isConcierge) {
    if (!order.assigned_ridechecker_id && !order.assigned_inspector_id) {
      return {
        icon: <ArrowRight className="h-4 w-4" />,
        text: isConcierge ? "Seller confirmed — assign RideChecker" : "Assign RideChecker",
        sub: "Choose and assign a RideChecker to perform the inspection",
      };
    }
  }

  if (order.assigned_ridechecker_id || order.assigned_inspector_id) {
    if (!order.report_status || order.report_status === "pending") {
      return {
        icon: <ArrowRight className="h-4 w-4" />,
        text: "RideChecker assigned — awaiting inspection",
        sub: "Inspection not yet submitted",
      };
    }
    if (order.report_status === "submitted" || order.report_status === "in_review") {
      return {
        icon: <ArrowRight className="h-4 w-4" />,
        text: "Submission received — review and generate report",
        sub: "Go to Report Builder to generate AI report",
      };
    }
    if (order.report_status === "draft") {
      return {
        icon: <ArrowRight className="h-4 w-4" />,
        text: "Report drafted — send to QA or approve",
        sub: "Review the report before delivering to buyer",
      };
    }
    if (order.report_status === "approved") {
      return {
        icon: <ArrowRight className="h-4 w-4" />,
        text: "Report ready — deliver to buyer",
        sub: "Click Deliver Report to send to buyer",
      };
    }
    if (order.report_status === "delivered" || order.report_status === "sent") {
      return {
        icon: <CheckCircle2 className="h-4 w-4" />,
        text: "Report delivered — order complete",
        sub: "All steps completed",
      };
    }
  }

  return {
    icon: <ArrowRight className="h-4 w-4" />,
    text: "Review order and take next step",
    sub: undefined,
  };
}

export function NextActionPanel({ order, attemptCount }: NextActionPanelProps) {
  const { urgency, daysOverdue } = getOverdueInfo(
    order.preferred_date,
    order.ops_status || order.status || "new"
  );
  const nextAction = getNextAction(order, attemptCount);
  const isComplete = urgency === "complete" || order.report_status === "delivered" || order.report_status === "sent";

  return (
    <div className="space-y-2" data-testid="next-action-panel">
      {/* Overdue / urgency indicator */}
      {urgency === "overdue" && (
        <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-800 px-4 py-3">
          <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className="bg-red-600 text-white no-default-hover-elevate no-default-active-elevate text-xs">
                OVERDUE
              </Badge>
              <span className="text-sm font-medium text-red-800 dark:text-red-300">
                Requested for{" "}
                {order.preferred_date
                  ? new Date(order.preferred_date).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })
                  : "—"}{" "}
                — overdue by {daysOverdue} day{daysOverdue !== 1 ? "s" : ""}
              </span>
            </div>
            <p className="text-xs text-red-700 dark:text-red-400 mt-0.5">
              Next action: Escalate / Contact Buyer
            </p>
          </div>
        </div>
      )}

      {urgency === "due_today" && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 px-4 py-3">
          <CalendarClock className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Badge className="bg-amber-500 text-white no-default-hover-elevate no-default-active-elevate text-xs">
                DUE TODAY
              </Badge>
              <span className="text-sm font-medium text-amber-800 dark:text-amber-300">
                Inspection scheduled for today
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Next action card */}
      <Card
        className={
          isComplete
            ? "border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-800"
            : "border-primary/30 bg-primary/5 dark:bg-primary/10"
        }
        data-testid="card-next-action"
      >
        <CardContent className="py-3 px-4">
          <div className="flex items-start gap-3">
            <div className={`mt-0.5 shrink-0 ${isComplete ? "text-green-600" : "text-primary"}`}>
              {isComplete ? <CheckCircle2 className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
            </div>
            <div className="min-w-0">
              <p className={`text-sm font-semibold ${isComplete ? "text-green-800 dark:text-green-300" : ""}`}>
                {isComplete ? "Order Complete" : "Next: "}
                {!isComplete && nextAction.text}
              </p>
              {nextAction.sub && !isComplete && (
                <p className="text-xs text-muted-foreground mt-0.5">{nextAction.sub}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
