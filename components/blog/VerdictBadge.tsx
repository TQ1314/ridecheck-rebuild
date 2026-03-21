import type { VerdictType } from "@/lib/blog/types";
import { CheckCircle2, AlertTriangle, XCircle, AlertCircle, ShieldCheck } from "lucide-react";

const VERDICT_CONFIG: Record<
  VerdictType,
  { label: string; icon: React.ReactNode; styles: string }
> = {
  BUY: {
    label: "Green Light",
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    styles: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  BUY_WITH_CAUTION: {
    label: "Proceed With Caution",
    icon: <AlertCircle className="h-3.5 w-3.5" />,
    styles: "bg-amber-50 text-amber-700 border-amber-200",
  },
  DO_NOT_BUY: {
    label: "Do Not Buy",
    icon: <XCircle className="h-3.5 w-3.5" />,
    styles: "bg-red-50 text-red-700 border-red-200",
  },
  RED_FLAG: {
    label: "Red Flag",
    icon: <AlertTriangle className="h-3.5 w-3.5" />,
    styles: "bg-red-50 text-red-800 border-red-300",
  },
  CLEAN: {
    label: "Clean Report",
    icon: <ShieldCheck className="h-3.5 w-3.5" />,
    styles: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
};

interface VerdictBadgeProps {
  verdict: VerdictType;
}

export function VerdictBadge({ verdict }: VerdictBadgeProps) {
  const config = VERDICT_CONFIG[verdict];
  if (!config) return null;

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full border ${config.styles}`}
    >
      {config.icon}
      {config.label}
    </span>
  );
}
