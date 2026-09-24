import type { ReactNode } from "react";

export function OrderSummaryRow({ label, children, testId }: {
  label: string;
  children: ReactNode;
  testId?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="shrink-0 text-gray-600">{label}</span>
      <span className="min-w-0 break-words text-right font-medium" data-testid={testId}>
        {children}
      </span>
    </div>
  );
}