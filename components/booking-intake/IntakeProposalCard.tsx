import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const INTAKE_LABELS: Record<string, string> = {
  year: "Year",
  make: "Make",
  model: "Model",
  trim: "Trim",
  mileage: "Mileage",
  asking_price: "Asking price",
  location_text: "Vehicle location",
  service_zip: "Service ZIP",
  vin: "VIN",
  seller_name: "Seller name",
  seller_phone: "Seller phone",
  discovery_source: "Discovery source",
  platform_source: "Platform",
};

type Proposal = Record<string, { value: string | number | null }>;

export function IntakeProposalCard({
  proposal,
  onChange,
  onConfirm,
  onManual,
}: {
  proposal: Proposal;
  onChange: (key: string, value: string) => void;
  onConfirm: () => void;
  onManual: () => void;
}) {
  const visibleFields = Object.entries(proposal).filter(([, field]) => field?.value != null && field.value !== "");
  if (!visibleFields.length) return null;

  return (
    <Card className="bg-background" data-testid="card-intake-proposal">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">We found these details</CardTitle>
        <p className="text-xs text-muted-foreground">Review and confirm. Missing details stay unknown and can be entered below.</p>
      </CardHeader>
      <CardContent className="space-y-2">
        {visibleFields.map(([key, field]) => (
          <div className="flex justify-between gap-3 text-sm" key={key}>
            <span className="text-muted-foreground">{INTAKE_LABELS[key] || key}</span>
            <Input
              className="h-8 max-w-[62%] text-right"
              value={String(field.value)}
              onChange={(event) => onChange(key, event.target.value)}
              aria-label={`Edit ${INTAKE_LABELS[key] || key}`}
              data-testid={`input-intake-proposal-${key}`}
            />
          </div>
        ))}
        <div className="flex gap-2 pt-2">
          <Button type="button" onClick={onConfirm} data-testid="button-confirm-intake">Confirm and use these</Button>
          <Button type="button" variant="outline" onClick={onManual} data-testid="button-edit-intake">Edit manually</Button>
        </div>
      </CardContent>
    </Card>
  );
}