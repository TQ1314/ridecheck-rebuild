import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

interface InspectionDisclaimerProps {
  variant?: "banner" | "inline" | "compact";
  className?: string;
}

export function InspectionDisclaimer({
  variant = "inline",
  className,
}: InspectionDisclaimerProps) {
  if (variant === "compact") {
    return (
      <p className={cn("text-xs text-muted-foreground leading-relaxed", className)}>
        RideCheck provides independent, non-invasive pre-purchase vehicle inspections and
        documented findings based on observable conditions at the time of service. RideCheck
        does not provide repairs, warranties, guarantees, or assurances of future vehicle
        condition.{" "}
        <Link
          href="/inspection-disclaimer"
          className="underline underline-offset-2 hover:text-foreground"
        >
          Learn more
        </Link>
      </p>
    );
  }

  if (variant === "banner") {
    return (
      <div
        className={cn(
          "rounded-lg border border-amber-200 bg-amber-50 px-4 py-3",
          className,
        )}
      >
        <div className="flex items-start gap-3">
          <ShieldAlert className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-900 mb-1">Inspection Scope Notice</p>
            <p className="text-xs text-amber-800 leading-relaxed">
              RideCheck provides a <strong>visual, non-invasive</strong> inspection and
              observational report only. This is not a warranty, guarantee, or certification
              of vehicle condition. Hidden, intermittent, or concealed issues may not be
              detected. The final purchase decision is yours alone.{" "}
              <Link
                href="/inspection-disclaimer"
                className="underline underline-offset-2 hover:text-amber-900"
              >
                Full disclaimer
              </Link>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // default: inline
  return (
    <div
      className={cn(
        "rounded-lg border bg-muted/40 px-4 py-4",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <ShieldAlert className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
        <div className="space-y-2">
          <p className="text-sm font-semibold">Inspection Scope &amp; Limitations</p>
          <ul className="space-y-1.5">
            {[
              "Non-invasive, visual assessment of observable conditions at the time of inspection only.",
              "Does not include engine teardown, compression testing, frame measurement, or any destructive testing.",
              "Hidden, intermittent, concealed, or inaccessible issues may not be detected.",
              "Not a warranty, guarantee, certification, or prediction of future performance.",
              "Not a substitute for a comprehensive repair shop inspection or dealership diagnostic.",
              "Findings may be affected by weather, lighting, vehicle cleanliness, and seller access restrictions.",
              "Repair estimates are non-binding and for informational purposes only.",
              "The buyer remains solely responsible for the vehicle purchase decision.",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2 text-xs text-muted-foreground">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/50" />
                {item}
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            <Link
              href="/inspection-disclaimer"
              className="text-primary underline underline-offset-2 hover:no-underline"
            >
              Read the full Inspection Disclaimer →
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
