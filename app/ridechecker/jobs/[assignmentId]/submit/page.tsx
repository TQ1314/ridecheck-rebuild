"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import {
  Camera,
  Car,
  Plus,
  X,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
} from "lucide-react";
import Link from "next/link";

interface AssignmentDetails {
  id: string;
  order_id: string;
  status: string;
  vehicle_year?: string;
  vehicle_make?: string;
  vehicle_model?: string;
  vehicle_location?: string;
  inspection_address?: string;
  scheduled_date?: string;
  scheduled_time?: string;
}

interface FormData {
  vin_photo_url: string;
  odometer_photo_url: string;
  under_hood_photo_url: string;
  undercarriage_photo_url: string;
  tire_tread_mm_front_left: string;
  tire_tread_mm_front_right: string;
  tire_tread_mm_rear_left: string;
  tire_tread_mm_rear_right: string;
  brake_condition: string;
  scan_codes: string[];
  cosmetic_exterior: string;
  interior_condition: string;
  mechanical_issues: string;
  test_drive_notes: string;
  immediate_concerns: string;
  audio_note_url: string;
  extra_photos: string[];
}

const REQUIRED_FIELDS: { key: keyof FormData; label: string }[] = [
  { key: "vin_photo_url", label: "VIN Photo URL" },
  { key: "odometer_photo_url", label: "Odometer Photo URL" },
  { key: "under_hood_photo_url", label: "Under Hood Photo URL" },
  { key: "undercarriage_photo_url", label: "Undercarriage Photo URL" },
  { key: "cosmetic_exterior", label: "Cosmetic Exterior" },
  { key: "interior_condition", label: "Interior Condition" },
  { key: "mechanical_issues", label: "Mechanical Issues" },
  { key: "test_drive_notes", label: "Test Drive Notes" },
  { key: "immediate_concerns", label: "Immediate Concerns" },
];

export default function RideCheckerSubmitPage() {
  const router = useRouter();
  const params = useParams();
  const assignmentId = params.assignmentId as string;
  const { toast } = useToast();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [assignment, setAssignment] = useState<AssignmentDetails | null>(null);
  const [scanCodeInput, setScanCodeInput] = useState("");

  const [form, setForm] = useState<FormData>({
    vin_photo_url: "",
    odometer_photo_url: "",
    under_hood_photo_url: "",
    undercarriage_photo_url: "",
    tire_tread_mm_front_left: "",
    tire_tread_mm_front_right: "",
    tire_tread_mm_rear_left: "",
    tire_tread_mm_rear_right: "",
    brake_condition: "",
    scan_codes: [],
    cosmetic_exterior: "",
    interior_condition: "",
    mechanical_issues: "",
    test_drive_notes: "",
    immediate_concerns: "",
    audio_note_url: "",
    extra_photos: [],
  });

  useEffect(() => {
    async function load() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        router.push("/auth/login");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .maybeSingle();

      if (
        !profile ||
        !["ridechecker_active", "owner"].includes(profile.role)
      ) {
        router.push("/auth/login");
        return;
      }

      try {
        const res = await fetch("/api/ridechecker/jobs");
        if (res.ok) {
          const data = await res.json();
          const found = data.assignments?.find(
            (a: any) => a.id === assignmentId
          );
          if (found) {
            const job = data.jobs?.find(
              (j: any) => j.order_id === found.order_id
            );
            setAssignment({
              id: found.id,
              order_id: found.order_id,
              status: found.status,
              vehicle_year: job?.vehicle_year || found.vehicle_year,
              vehicle_make: job?.vehicle_make || found.vehicle_make,
              vehicle_model: job?.vehicle_model || found.vehicle_model,
              vehicle_location:
                job?.vehicle_location || found.vehicle_location,
              inspection_address:
                job?.inspection_address || found.inspection_address,
              scheduled_date: job?.scheduled_date || found.scheduled_date,
              scheduled_time: job?.scheduled_time || found.scheduled_time,
            });
          }
        }
      } catch {}

      setLoading(false);
    }
    load();
  }, [assignmentId]);

  const filledCount = REQUIRED_FIELDS.filter((f) => {
    const val = form[f.key];
    return typeof val === "string" && val.trim().length > 0;
  }).length;

  const totalRequired = REQUIRED_FIELDS.length;
  const allRequiredFilled = filledCount === totalRequired;
  const progressPercent = Math.round((filledCount / totalRequired) * 100);

  const updateField = (key: keyof FormData, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const addScanCode = () => {
    const code = scanCodeInput.trim();
    if (code && !form.scan_codes.includes(code)) {
      setForm((prev) => ({
        ...prev,
        scan_codes: [...prev.scan_codes, code],
      }));
      setScanCodeInput("");
    }
  };

  const removeScanCode = (code: string) => {
    setForm((prev) => ({
      ...prev,
      scan_codes: prev.scan_codes.filter((c) => c !== code),
    }));
  };

  const addExtraPhoto = () => {
    setForm((prev) => ({
      ...prev,
      extra_photos: [...prev.extra_photos, ""],
    }));
  };

  const updateExtraPhoto = (index: number, value: string) => {
    setForm((prev) => {
      const updated = [...prev.extra_photos];
      updated[index] = value;
      return { ...prev, extra_photos: updated };
    });
  };

  const removeExtraPhoto = (index: number) => {
    setForm((prev) => ({
      ...prev,
      extra_photos: prev.extra_photos.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async () => {
    if (!allRequiredFilled) {
      toast({
        title: "Please fill all required fields",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const payload: any = {
        vin_photo_url: form.vin_photo_url.trim(),
        odometer_photo_url: form.odometer_photo_url.trim(),
        under_hood_photo_url: form.under_hood_photo_url.trim(),
        undercarriage_photo_url: form.undercarriage_photo_url.trim(),
        cosmetic_exterior: form.cosmetic_exterior.trim(),
        interior_condition: form.interior_condition.trim(),
        mechanical_issues: form.mechanical_issues.trim(),
        test_drive_notes: form.test_drive_notes.trim(),
        immediate_concerns: form.immediate_concerns.trim(),
      };

      if (form.tire_tread_mm_front_left)
        payload.tire_tread_mm_front_left = Number(
          form.tire_tread_mm_front_left
        );
      if (form.tire_tread_mm_front_right)
        payload.tire_tread_mm_front_right = Number(
          form.tire_tread_mm_front_right
        );
      if (form.tire_tread_mm_rear_left)
        payload.tire_tread_mm_rear_left = Number(
          form.tire_tread_mm_rear_left
        );
      if (form.tire_tread_mm_rear_right)
        payload.tire_tread_mm_rear_right = Number(
          form.tire_tread_mm_rear_right
        );

      if (form.brake_condition) payload.brake_condition = form.brake_condition;

      if (form.scan_codes.length > 0) payload.scan_codes = form.scan_codes;

      if (form.audio_note_url.trim())
        payload.audio_note_url = form.audio_note_url.trim();

      const filteredPhotos = form.extra_photos.filter(
        (p) => p.trim().length > 0
      );
      if (filteredPhotos.length > 0) payload.extra_photos = filteredPhotos;

      const res = await fetch(
        `/api/ridechecker/jobs/${assignmentId}/submit`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      if (res.ok) {
        toast({ title: "Submission saved successfully!" });
        router.push("/ridechecker/dashboard");
      } else {
        const data = await res.json();
        toast({
          title: data.error || "Failed to submit",
          variant: "destructive",
        });
      }
    } catch {
      toast({ title: "Failed to submit", variant: "destructive" });
    }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <AppShell>
        <div className="flex h-64 items-center justify-center">
          <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="p-6 space-y-6 max-w-3xl mx-auto">
        <div className="flex items-center gap-3 flex-wrap">
          <Link href="/ridechecker/dashboard">
            <Button
              size="icon"
              variant="ghost"
              data-testid="button-back"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1
              className="text-2xl font-bold"
              data-testid="text-submit-title"
            >
              Submit Raw Data
            </h1>
            <p className="text-muted-foreground text-sm">
              Complete the inspection checklist for this assignment
            </p>
          </div>
        </div>

        {assignment && (
          <Card>
            <CardContent className="flex items-center gap-3 p-4 flex-wrap">
              <Car className="h-5 w-5 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <span
                  className="font-semibold"
                  data-testid="text-vehicle-info"
                >
                  {assignment.vehicle_year} {assignment.vehicle_make}{" "}
                  {assignment.vehicle_model}
                </span>
                {(assignment.inspection_address ||
                  assignment.vehicle_location) && (
                  <p className="text-sm text-muted-foreground">
                    {assignment.inspection_address ||
                      assignment.vehicle_location}
                  </p>
                )}
              </div>
              <Badge variant="outline" data-testid="badge-assignment-status">
                {assignment.status?.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
              </Badge>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              {allRequiredFilled ? (
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              ) : (
                <AlertCircle className="h-4 w-4 text-red-500" />
              )}
              Checklist Progress
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span
                className={`text-sm font-medium ${allRequiredFilled ? "text-green-600" : "text-red-500"}`}
                data-testid="text-progress-count"
              >
                {filledCount}/{totalRequired} required fields complete
              </span>
              <span className="text-sm text-muted-foreground">
                {progressPercent}%
              </span>
            </div>
            <Progress
              value={progressPercent}
              className={`h-2 ${allRequiredFilled ? "[&>div]:bg-green-600" : "[&>div]:bg-red-500"}`}
              data-testid="progress-checklist"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Camera className="h-4 w-4 text-muted-foreground" />
              Required Photos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="vin_photo_url">
                  VIN Photo URL <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="vin_photo_url"
                  placeholder="https://..."
                  value={form.vin_photo_url}
                  onChange={(e) =>
                    updateField("vin_photo_url", e.target.value)
                  }
                  data-testid="input-vin-photo-url"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="odometer_photo_url">
                  Odometer Photo URL <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="odometer_photo_url"
                  placeholder="https://..."
                  value={form.odometer_photo_url}
                  onChange={(e) =>
                    updateField("odometer_photo_url", e.target.value)
                  }
                  data-testid="input-odometer-photo-url"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="under_hood_photo_url">
                  Under Hood Photo URL{" "}
                  <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="under_hood_photo_url"
                  placeholder="https://..."
                  value={form.under_hood_photo_url}
                  onChange={(e) =>
                    updateField("under_hood_photo_url", e.target.value)
                  }
                  data-testid="input-under-hood-photo-url"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="undercarriage_photo_url">
                  Undercarriage Photo URL{" "}
                  <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="undercarriage_photo_url"
                  placeholder="https://..."
                  value={form.undercarriage_photo_url}
                  onChange={(e) =>
                    updateField("undercarriage_photo_url", e.target.value)
                  }
                  data-testid="input-undercarriage-photo-url"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tire Tread Depth</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="tire_fl">Front Left (mm)</Label>
                <Input
                  id="tire_fl"
                  type="number"
                  step="0.1"
                  min="0"
                  placeholder="mm"
                  value={form.tire_tread_mm_front_left}
                  onChange={(e) =>
                    updateField("tire_tread_mm_front_left", e.target.value)
                  }
                  data-testid="input-tire-front-left"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tire_fr">Front Right (mm)</Label>
                <Input
                  id="tire_fr"
                  type="number"
                  step="0.1"
                  min="0"
                  placeholder="mm"
                  value={form.tire_tread_mm_front_right}
                  onChange={(e) =>
                    updateField("tire_tread_mm_front_right", e.target.value)
                  }
                  data-testid="input-tire-front-right"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tire_rl">Rear Left (mm)</Label>
                <Input
                  id="tire_rl"
                  type="number"
                  step="0.1"
                  min="0"
                  placeholder="mm"
                  value={form.tire_tread_mm_rear_left}
                  onChange={(e) =>
                    updateField("tire_tread_mm_rear_left", e.target.value)
                  }
                  data-testid="input-tire-rear-left"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tire_rr">Rear Right (mm)</Label>
                <Input
                  id="tire_rr"
                  type="number"
                  step="0.1"
                  min="0"
                  placeholder="mm"
                  value={form.tire_tread_mm_rear_right}
                  onChange={(e) =>
                    updateField("tire_tread_mm_rear_right", e.target.value)
                  }
                  data-testid="input-tire-rear-right"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Brake Condition</CardTitle>
          </CardHeader>
          <CardContent>
            <Select
              value={form.brake_condition}
              onValueChange={(val) => updateField("brake_condition", val)}
            >
              <SelectTrigger data-testid="select-brake-condition">
                <SelectValue placeholder="Select condition..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="good">Good</SelectItem>
                <SelectItem value="fair">Fair</SelectItem>
                <SelectItem value="poor">Poor</SelectItem>
                <SelectItem value="unknown">Unknown</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Scan Codes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Input
                placeholder="Enter code (e.g. P0301)"
                value={scanCodeInput}
                onChange={(e) => setScanCodeInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addScanCode();
                  }
                }}
                className="flex-1 min-w-[150px]"
                data-testid="input-scan-code"
              />
              <Button
                variant="outline"
                onClick={addScanCode}
                data-testid="button-add-scan-code"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
            </div>
            {form.scan_codes.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {form.scan_codes.map((code) => (
                  <Badge
                    key={code}
                    variant="secondary"
                    className="gap-1"
                    data-testid={`badge-scan-code-${code}`}
                  >
                    {code}
                    <button
                      onClick={() => removeScanCode(code)}
                      className="ml-1"
                      data-testid={`button-remove-scan-code-${code}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Inspection Notes <span className="text-red-500">*</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="cosmetic_exterior">
                Cosmetic Exterior <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="cosmetic_exterior"
                placeholder="Describe exterior condition, paint, dents, scratches..."
                value={form.cosmetic_exterior}
                onChange={(e) =>
                  updateField("cosmetic_exterior", e.target.value)
                }
                rows={3}
                data-testid="textarea-cosmetic-exterior"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="interior_condition">
                Interior Condition <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="interior_condition"
                placeholder="Describe interior condition, seats, dashboard, electronics..."
                value={form.interior_condition}
                onChange={(e) =>
                  updateField("interior_condition", e.target.value)
                }
                rows={3}
                data-testid="textarea-interior-condition"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mechanical_issues">
                Mechanical Issues <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="mechanical_issues"
                placeholder="Note any mechanical issues, engine, transmission, suspension..."
                value={form.mechanical_issues}
                onChange={(e) =>
                  updateField("mechanical_issues", e.target.value)
                }
                rows={3}
                data-testid="textarea-mechanical-issues"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="test_drive_notes">
                Test Drive Notes <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="test_drive_notes"
                placeholder="Describe test drive experience, handling, braking, noises..."
                value={form.test_drive_notes}
                onChange={(e) =>
                  updateField("test_drive_notes", e.target.value)
                }
                rows={3}
                data-testid="textarea-test-drive-notes"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="immediate_concerns">
                Immediate Concerns <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="immediate_concerns"
                placeholder="Any safety concerns or issues requiring immediate attention..."
                value={form.immediate_concerns}
                onChange={(e) =>
                  updateField("immediate_concerns", e.target.value)
                }
                rows={3}
                data-testid="textarea-immediate-concerns"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Optional Fields</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="audio_note_url">Audio Note URL</Label>
              <Input
                id="audio_note_url"
                placeholder="https://..."
                value={form.audio_note_url}
                onChange={(e) =>
                  updateField("audio_note_url", e.target.value)
                }
                data-testid="input-audio-note-url"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <Label>Extra Photos</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addExtraPhoto}
                  data-testid="button-add-extra-photo"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Add Photo URL
                </Button>
              </div>
              {form.extra_photos.map((url, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    placeholder="https://..."
                    value={url}
                    onChange={(e) => updateExtraPhoto(i, e.target.value)}
                    className="flex-1"
                    data-testid={`input-extra-photo-${i}`}
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => removeExtraPhoto(i)}
                    data-testid={`button-remove-extra-photo-${i}`}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-end gap-3 pb-6 flex-wrap">
          <Link href="/ridechecker/dashboard">
            <Button
              variant="outline"
              data-testid="button-cancel"
            >
              Cancel
            </Button>
          </Link>
          <Button
            onClick={handleSubmit}
            disabled={!allRequiredFilled || submitting}
            data-testid="button-submit"
          >
            {submitting ? "Submitting..." : "Submit Raw Data"}
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
