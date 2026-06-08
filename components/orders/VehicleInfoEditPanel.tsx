"use client";

import { useState } from "react";
import type { Order } from "@/types/orders";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Car,
  Pencil,
  X,
  Save,
  AlertTriangle,
  CheckCircle2,
  Link as LinkIcon,
  MapPin,
  Phone,
  User,
  ArrowRight,
  ExternalLink,
  CreditCard,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils/pricing";

const PACKAGE_ORDER: Record<string, number> = {
  standard: 0,
  basic:    0,
  plus:     1,
  premium:  2,
  exotic:   3,
};

const PACKAGE_LABELS: Record<string, string> = {
  standard: "Standard",
  basic:    "Basic",
  plus:     "Plus",
  premium:  "Premium",
  exotic:   "Exotic",
};

interface VehicleInfoEditPanelProps {
  order: Order;
  onRefresh: () => void;
}

interface FormState {
  listing_url:      string;
  vehicle_year:     string;
  vehicle_make:     string;
  vehicle_model:    string;
  vehicle_trim:     string;
  vehicle_location: string;
  seller_name:      string;
  seller_phone:     string;
  package:          string;
  ops_internal_note: string;
}

export function VehicleInfoEditPanel({ order, onRefresh }: VehicleInfoEditPanelProps) {
  const { toast } = useToast();
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [markingNBI, setMarkingNBI] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [requestingUpgrade, setRequestingUpgrade] = useState(false);

  // After-save upgrade info
  const [upgradeInfo, setUpgradeInfo] = useState<{
    old_package: string;
    new_package: string;
    diff_cents: number | null;
  } | null>(null);

  const initForm = (): FormState => ({
    listing_url:       order.listing_url ?? "",
    vehicle_year:      String(order.vehicle_year ?? ""),
    vehicle_make:      order.vehicle_make ?? "",
    vehicle_model:     order.vehicle_model ?? "",
    vehicle_trim:      order.vehicle_trim ?? "",
    vehicle_location:  order.vehicle_location ?? "",
    seller_name:       order.seller_name ?? "",
    seller_phone:      order.seller_phone ?? "",
    package:           order.package ?? "standard",
    ops_internal_note: order.ops_internal_note ?? "",
  });

  const [form, setForm] = useState<FormState>(initForm);

  const isNeedsBuyerInfo = order.ops_status === "needs_buyer_info";

  // Detect package upgrade in the form
  const currentPkgRank = PACKAGE_ORDER[order.package ?? "standard"] ?? 0;
  const formPkgRank    = PACKAGE_ORDER[form.package] ?? 0;
  const isPackageUpgrade = form.package !== order.package && formPkgRank > currentPkgRank;

  function handleOpen() {
    setForm(initForm());
    setUpgradeInfo(null);
    setEditMode(true);
  }

  function handleCancel() {
    setEditMode(false);
    setUpgradeInfo(null);
  }

  function set(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function callVehicleInfo(
    extra: { mark_needs_buyer_info?: boolean; restore_to_contact_seller?: boolean } = {},
  ) {
    const payload: Record<string, any> = {
      listing_url:       form.listing_url   || null,
      vehicle_year:      form.vehicle_year  ? Number(form.vehicle_year) : undefined,
      vehicle_make:      form.vehicle_make  || undefined,
      vehicle_model:     form.vehicle_model || undefined,
      vehicle_trim:      form.vehicle_trim  || null,
      vehicle_location:  form.vehicle_location || undefined,
      seller_name:       form.seller_name   || null,
      seller_phone:      form.seller_phone  || null,
      package:           form.package       || undefined,
      ops_internal_note: form.ops_internal_note || null,
      ...extra,
    };

    const res = await fetch(`/api/admin/orders/${order.id}/vehicle-info`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return res;
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await callVehicleInfo();
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast({ title: "Save failed", description: data.error || "Unknown error", variant: "destructive" });
        return;
      }
      if (data.changed === false) {
        toast({ title: "No changes detected" });
        setEditMode(false);
        return;
      }
      if (data.package_upgraded) {
        setUpgradeInfo({
          old_package: data.old_package,
          new_package: data.new_package,
          diff_cents:  data.upgrade_diff_cents ?? null,
        });
      }
      toast({
        title: "Vehicle info saved",
        description: `Updated: ${(data.changed_fields ?? []).join(", ")}`,
      });
      setEditMode(false);
      onRefresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleMarkNBI() {
    setMarkingNBI(true);
    try {
      const res = await callVehicleInfo({ mark_needs_buyer_info: true });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast({ title: "Error", description: data.error || "Failed to mark", variant: "destructive" });
        return;
      }
      toast({ title: "Marked as Needs Buyer Info", description: "Ops status updated. Listing changes saved." });
      setEditMode(false);
      onRefresh();
    } finally {
      setMarkingNBI(false);
    }
  }

  async function handleRestoreContactSeller() {
    setRestoring(true);
    try {
      const res = await fetch(`/api/admin/orders/${order.id}/vehicle-info`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restore_to_contact_seller: true }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast({ title: "Error", description: data.error || "Failed to restore", variant: "destructive" });
        return;
      }
      toast({ title: "Status restored to Contact Seller" });
      setUpgradeInfo(null);
      onRefresh();
    } finally {
      setRestoring(false);
    }
  }

  async function handleRequestUpgradePayment() {
    if (!upgradeInfo?.diff_cents) return;
    setRequestingUpgrade(true);
    try {
      const res = await fetch(`/api/admin/orders/${order.id}/request-upgrade-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          diff_cents:  upgradeInfo.diff_cents,
          new_package: upgradeInfo.new_package,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast({ title: "Error", description: data.error || "Failed to request payment", variant: "destructive" });
        return;
      }
      toast({ title: "Upgrade payment link created", description: "Payment link sent to buyer email." });
      setUpgradeInfo(null);
      onRefresh();
    } finally {
      setRequestingUpgrade(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Car className="h-4 w-4 text-muted-foreground" />
            Listing &amp; Vehicle Info
          </CardTitle>
          {!editMode && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1 px-2"
              onClick={handleOpen}
              data-testid="button-edit-vehicle-info"
            >
              <Pencil className="h-3 w-3" />
              Edit
            </Button>
          )}
          {editMode && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1 px-2 text-muted-foreground"
              onClick={handleCancel}
              data-testid="button-cancel-vehicle-edit"
            >
              <X className="h-3 w-3" />
              Cancel
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-3 text-sm">

        {/* ── Needs Buyer Info banner ── */}
        {isNeedsBuyerInfo && !editMode && (
          <div className="flex items-start gap-2.5 rounded-md border border-amber-400 bg-amber-50 dark:bg-amber-950/30 px-3 py-2.5 text-xs" data-testid="banner-needs-buyer-info">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-amber-800 dark:text-amber-300">Needs Buyer Info</p>
              <p className="text-amber-700 dark:text-amber-400 mt-0.5">
                The listing URL may be dead or vehicle details are incorrect. Correct the info below, then restore to Contact Seller.
              </p>
            </div>
          </div>
        )}

        {/* ── Package upgrade callout (post-save) ── */}
        {upgradeInfo && (
          <div className="flex items-start gap-2.5 rounded-md border border-blue-400 bg-blue-50 dark:bg-blue-950/30 px-3 py-2.5 text-xs" data-testid="callout-package-upgrade">
            <CreditCard className="h-3.5 w-3.5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-blue-800 dark:text-blue-300">Package Upgraded</p>
              <p className="text-blue-700 dark:text-blue-400 mt-0.5">
                {PACKAGE_LABELS[upgradeInfo.old_package] || upgradeInfo.old_package}
                {" → "}
                {PACKAGE_LABELS[upgradeInfo.new_package] || upgradeInfo.new_package}
                {upgradeInfo.diff_cents
                  ? ` — ${formatCurrency(upgradeInfo.diff_cents / 100)} owed`
                  : " — calculate upgrade difference manually"}
              </p>
              {upgradeInfo.diff_cents && upgradeInfo.diff_cents > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2 h-7 text-xs border-blue-400 text-blue-700 hover:bg-blue-100"
                  onClick={handleRequestUpgradePayment}
                  disabled={requestingUpgrade}
                  data-testid="button-request-upgrade-payment"
                >
                  <CreditCard className="h-3 w-3 mr-1" />
                  {requestingUpgrade ? "Requesting…" : `Request ${formatCurrency(upgradeInfo.diff_cents / 100)} Upgrade Payment`}
                </Button>
              )}
            </div>
          </div>
        )}

        {/* ── READ mode ── */}
        {!editMode && (
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Vehicle</span>
              <span className="font-medium text-right">
                {order.vehicle_year} {order.vehicle_make} {order.vehicle_model}
                {order.vehicle_trim ? <span className="text-muted-foreground ml-1 font-normal">{order.vehicle_trim}</span> : null}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-muted-foreground flex items-center gap-1">
                <MapPin className="h-3 w-3" />Location
              </span>
              <span>{order.vehicle_location || <span className="text-muted-foreground italic">—</span>}</span>
            </div>

            {order.listing_url ? (
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground flex items-center gap-1">
                  <LinkIcon className="h-3 w-3" />Listing
                </span>
                <a
                  href={order.listing_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline flex items-center gap-1 max-w-[200px] truncate"
                  data-testid="link-listing-url"
                >
                  <ExternalLink className="h-3 w-3 flex-shrink-0" />
                  <span className="truncate">{order.listing_url}</span>
                </a>
              </div>
            ) : (
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground flex items-center gap-1">
                  <LinkIcon className="h-3 w-3" />Listing
                </span>
                <span className="text-muted-foreground italic text-xs">No URL provided</span>
              </div>
            )}

            {(order.seller_name || order.seller_phone) && (
              <div className="flex justify-between items-start">
                <span className="text-muted-foreground flex items-center gap-1">
                  <User className="h-3 w-3" />Seller
                </span>
                <div className="text-right">
                  {order.seller_name && <div>{order.seller_name}</div>}
                  {order.seller_phone && (
                    <div className="flex items-center gap-1 justify-end text-muted-foreground">
                      <Phone className="h-3 w-3" />
                      {order.seller_phone}
                    </div>
                  )}
                </div>
              </div>
            )}

            {order.ops_internal_note && (
              <div className="rounded-md bg-muted/50 px-2.5 py-2 text-xs text-muted-foreground border border-dashed" data-testid="text-ops-internal-note">
                <span className="font-medium text-foreground">Internal note:</span> {order.ops_internal_note}
              </div>
            )}

            {/* Restore button when needs_buyer_info */}
            {isNeedsBuyerInfo && (
              <Button
                size="sm"
                variant="outline"
                className="w-full h-8 text-xs mt-1 border-green-500 text-green-700 hover:bg-green-50 dark:hover:bg-green-950/30 gap-1"
                onClick={handleRestoreContactSeller}
                disabled={restoring}
                data-testid="button-restore-contact-seller"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                {restoring ? "Restoring…" : "Resolved — Restore to Contact Seller"}
                <ArrowRight className="h-3.5 w-3.5 ml-auto" />
              </Button>
            )}
          </div>
        )}

        {/* ── EDIT mode ── */}
        {editMode && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Year</Label>
                <Input
                  value={form.vehicle_year}
                  onChange={(e) => set("vehicle_year", e.target.value)}
                  placeholder="2019"
                  className="h-8 text-sm"
                  data-testid="input-vehicle-year"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Make</Label>
                <Input
                  value={form.vehicle_make}
                  onChange={(e) => set("vehicle_make", e.target.value)}
                  placeholder="Toyota"
                  className="h-8 text-sm"
                  data-testid="input-vehicle-make"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Model</Label>
                <Input
                  value={form.vehicle_model}
                  onChange={(e) => set("vehicle_model", e.target.value)}
                  placeholder="Camry"
                  className="h-8 text-sm"
                  data-testid="input-vehicle-model"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Trim</Label>
                <Input
                  value={form.vehicle_trim}
                  onChange={(e) => set("vehicle_trim", e.target.value)}
                  placeholder="XSE (optional)"
                  className="h-8 text-sm"
                  data-testid="input-vehicle-trim"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Location</Label>
              <Input
                value={form.vehicle_location}
                onChange={(e) => set("vehicle_location", e.target.value)}
                placeholder="City, State"
                className="h-8 text-sm"
                data-testid="input-vehicle-location"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs flex items-center gap-1">
                <LinkIcon className="h-3 w-3" />
                Listing URL
              </Label>
              <Input
                value={form.listing_url}
                onChange={(e) => set("listing_url", e.target.value)}
                placeholder="https://facebook.com/marketplace/..."
                className="h-8 text-sm"
                data-testid="input-listing-url"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1">
                  <User className="h-3 w-3" />Seller Name
                </Label>
                <Input
                  value={form.seller_name}
                  onChange={(e) => set("seller_name", e.target.value)}
                  placeholder="John Smith"
                  className="h-8 text-sm"
                  data-testid="input-seller-name"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1">
                  <Phone className="h-3 w-3" />Seller Phone
                </Label>
                <Input
                  value={form.seller_phone}
                  onChange={(e) => set("seller_phone", e.target.value)}
                  placeholder="(555) 000-0000"
                  className="h-8 text-sm"
                  data-testid="input-seller-phone"
                />
              </div>
            </div>

            {/* Package selector */}
            <div className="space-y-1">
              <Label className="text-xs">Package</Label>
              <Select
                value={form.package}
                onValueChange={(v) => set("package", v)}
              >
                <SelectTrigger className="h-8 text-sm" data-testid="select-package">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">Standard</SelectItem>
                  <SelectItem value="plus">Plus</SelectItem>
                  <SelectItem value="premium">Premium</SelectItem>
                  <SelectItem value="exotic">Exotic</SelectItem>
                </SelectContent>
              </Select>
              {isPackageUpgrade && (
                <p className="text-[11px] text-blue-600 dark:text-blue-400 flex items-center gap-1 mt-1">
                  <CreditCard className="h-3 w-3" />
                  Upgrade from {PACKAGE_LABELS[order.package] || order.package} → {PACKAGE_LABELS[form.package]}. Saving will calculate the difference owed.
                </p>
              )}
            </div>

            {/* Internal ops note */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Internal Ops Note (not visible to buyer)</Label>
              <Textarea
                value={form.ops_internal_note}
                onChange={(e) => set("ops_internal_note", e.target.value)}
                placeholder="e.g. Buyer submitted wrong URL — correct link confirmed via text"
                rows={2}
                className="text-sm resize-none"
                data-testid="textarea-ops-internal-note"
              />
            </div>

            {/* Action buttons */}
            <div className="flex flex-col gap-2 pt-1 border-t">
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 h-8 text-xs border-amber-400 text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/30 gap-1"
                  onClick={handleMarkNBI}
                  disabled={markingNBI || saving}
                  data-testid="button-mark-needs-buyer-info"
                >
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {markingNBI ? "Marking…" : "Mark Needs Buyer Info"}
                </Button>

                <Button
                  size="sm"
                  className="flex-1 h-8 text-xs gap-1"
                  onClick={handleSave}
                  disabled={saving || markingNBI}
                  data-testid="button-save-vehicle-info"
                >
                  <Save className="h-3.5 w-3.5" />
                  {saving ? "Saving…" : "Save Corrected Info"}
                </Button>
              </div>

              {isNeedsBuyerInfo && (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full h-8 text-xs border-green-500 text-green-700 hover:bg-green-50 dark:hover:bg-green-950/30 gap-1"
                  onClick={handleRestoreContactSeller}
                  disabled={restoring}
                  data-testid="button-restore-contact-seller-edit"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {restoring ? "Restoring…" : "Resolved — Restore to Contact Seller"}
                </Button>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
