"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/layout/Logo";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import {
  ShieldCheck,
  Upload,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileImage,
  Camera,
} from "lucide-react";

type UploadState = "idle" | "uploading" | "done" | "error";

interface FileUploadField {
  file: File | null;
  path: string | null;
  state: UploadState;
  error: string | null;
}

export default function RideCheckerVerifyPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const { toast } = useToast();

  const isRejected = searchParams.get("status") === "rejected";

  const [userId, setUserId] = useState<string | null>(null);
  const [rejectionNotes, setRejectionNotes] = useState<string | null>(null);
  const [pageState, setPageState] = useState<"loading" | "ready" | "unauthorized">("loading");
  const [submitting, setSubmitting] = useState(false);

  const [legalName, setLegalName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [addressCity, setAddressCity] = useState("");
  const [addressState, setAddressState] = useState("");
  const [addressZip, setAddressZip] = useState("");
  const [hasTransport, setHasTransport] = useState(false);
  const [agreement, setAgreement] = useState(false);

  const [idDoc, setIdDoc] = useState<FileUploadField>({
    file: null, path: null, state: "idle", error: null,
  });
  const [selfie, setSelfie] = useState<FileUploadField>({
    file: null, path: null, state: "idle", error: null,
  });

  useEffect(() => {
    async function checkAuth() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/auth/login?redirect=/ridechecker/verify");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role, verification_status, verification_review_notes, full_name")
        .eq("id", session.user.id)
        .maybeSingle();

      if (!profile || profile.role !== "ridechecker") {
        setPageState("unauthorized");
        return;
      }

      if (profile.verification_status === "submitted") {
        router.replace("/ridechecker/verification-pending");
        return;
      }

      if (profile.verification_status === "active") {
        router.replace("/ridechecker/dashboard");
        return;
      }

      if (profile.verification_review_notes) {
        setRejectionNotes(profile.verification_review_notes);
      }

      if (profile.full_name) {
        setLegalName(profile.full_name);
      }

      setUserId(session.user.id);
      setPageState("ready");
    }
    checkAuth();
  }, []);

  async function uploadFile(
    setField: React.Dispatch<React.SetStateAction<FileUploadField>>,
    fileType: "id_document" | "selfie",
    file: File
  ) {
    if (!userId) return;
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${userId}/${fileType}.${ext}`;

    setField((prev) => ({ ...prev, file, state: "uploading", error: null }));

    const { error } = await supabase.storage
      .from("ridechecker-verifications")
      .upload(path, file, { upsert: true });

    if (error) {
      setField((prev) => ({
        ...prev,
        state: "error",
        error: "Upload failed. Please try again.",
      }));
      return;
    }

    setField((prev) => ({ ...prev, path, state: "done", error: null }));
  }

  const handleFileChange =
    (
      setField: React.Dispatch<React.SetStateAction<FileUploadField>>,
      fileType: "id_document" | "selfie"
    ) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const validTypes = ["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"];
      if (!validTypes.includes(file.type) && !file.name.match(/\.(jpg|jpeg|png|webp|heic|pdf)$/i)) {
        setField((prev) => ({
          ...prev,
          error: "Invalid file type. Use JPG, PNG, WEBP, HEIC, or PDF.",
          state: "error",
        }));
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        setField((prev) => ({
          ...prev,
          error: "File too large. Maximum size is 10 MB.",
          state: "error",
        }));
        return;
      }
      uploadFile(setField, fileType, file);
    };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!legalName.trim() || !dateOfBirth || !addressLine1.trim() || !addressCity.trim() || !addressState.trim() || !addressZip.trim()) {
      toast({ title: "All personal information fields are required.", variant: "destructive" });
      return;
    }
    if (!idDoc.path || idDoc.state !== "done") {
      toast({ title: "Please upload your driver's license or state ID.", variant: "destructive" });
      return;
    }
    if (!selfie.path || selfie.state !== "done") {
      toast({ title: "Please upload your selfie.", variant: "destructive" });
      return;
    }
    if (!hasTransport) {
      toast({ title: "Please confirm you have reliable transportation.", variant: "destructive" });
      return;
    }
    if (!agreement) {
      toast({ title: "Please read and accept the contractor agreement.", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/ridechecker/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          legal_name: legalName.trim(),
          date_of_birth: dateOfBirth,
          address_line1: addressLine1.trim(),
          address_city: addressCity.trim(),
          address_state: addressState.trim(),
          address_zip: addressZip.trim(),
          id_document_path: idDoc.path,
          selfie_path: selfie.path,
          has_reliable_transportation: hasTransport,
          agreement_accepted: agreement,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Submission failed");

      router.push("/ridechecker/verification-pending");
    } catch (err: any) {
      toast({ title: err.message || "Failed to submit verification.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (pageState === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (pageState === "unauthorized") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-sm w-full text-center">
          <CardContent className="pt-8 pb-6">
            <AlertCircle className="h-10 w-10 text-destructive mx-auto mb-3" />
            <p className="font-semibold">Access Denied</p>
            <p className="text-sm text-muted-foreground mt-1">This page is only for approved RideChecker applicants.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex flex-col items-center gap-2 text-center mb-2">
          <Logo />
          <div className="mt-4 flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold" data-testid="text-verify-title">Identity Verification</h1>
          </div>
          <p className="text-muted-foreground text-sm max-w-lg">
            Before you can receive assignments, we need to verify your identity.
            All information is kept private and used only for verification purposes.
          </p>
        </div>

        {isRejected && rejectionNotes && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 flex gap-3">
            <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-sm text-destructive">Verification Rejected</p>
              <p className="text-sm text-muted-foreground mt-1">
                Your previous submission was not approved. Please correct the following and resubmit:
              </p>
              <p className="text-sm mt-1 font-medium">{rejectionNotes}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Personal Information */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Personal Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="legal_name">Legal Full Name <span className="text-destructive">*</span></Label>
                <Input
                  id="legal_name"
                  value={legalName}
                  onChange={(e) => setLegalName(e.target.value)}
                  placeholder="As it appears on your ID"
                  required
                  data-testid="input-legal-name"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="date_of_birth">Date of Birth <span className="text-destructive">*</span></Label>
                <Input
                  id="date_of_birth"
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  max={new Date(Date.now() - 18 * 365.25 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]}
                  required
                  data-testid="input-date-of-birth"
                />
              </div>
            </CardContent>
          </Card>

          {/* Current Address */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Current Address</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="address_line1">Street Address <span className="text-destructive">*</span></Label>
                <Input
                  id="address_line1"
                  value={addressLine1}
                  onChange={(e) => setAddressLine1(e.target.value)}
                  placeholder="123 Main St, Apt 4B"
                  required
                  data-testid="input-address-line1"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="address_city">City <span className="text-destructive">*</span></Label>
                  <Input
                    id="address_city"
                    value={addressCity}
                    onChange={(e) => setAddressCity(e.target.value)}
                    placeholder="Waukegan"
                    required
                    data-testid="input-address-city"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="address_state">State <span className="text-destructive">*</span></Label>
                  <Input
                    id="address_state"
                    value={addressState}
                    onChange={(e) => setAddressState(e.target.value.toUpperCase().slice(0, 2))}
                    placeholder="IL"
                    maxLength={2}
                    required
                    data-testid="input-address-state"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="address_zip">ZIP Code <span className="text-destructive">*</span></Label>
                <Input
                  id="address_zip"
                  value={addressZip}
                  onChange={(e) => setAddressZip(e.target.value.replace(/\D/g, "").slice(0, 5))}
                  placeholder="60085"
                  maxLength={5}
                  required
                  data-testid="input-address-zip"
                />
              </div>
            </CardContent>
          </Card>

          {/* Document Uploads */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Identity Documents</CardTitle>
              <p className="text-sm text-muted-foreground">
                Upload clear, readable photos. Accepted: JPG, PNG, WEBP, HEIC, PDF (max 10 MB each).
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* ID Document */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <FileImage className="h-4 w-4 text-muted-foreground" />
                  Driver's License or State ID <span className="text-destructive">*</span>
                </Label>
                <p className="text-xs text-muted-foreground">Front of your government-issued photo ID.</p>
                <div
                  className={`relative border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                    idDoc.state === "done"
                      ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20"
                      : idDoc.state === "error"
                      ? "border-destructive bg-destructive/5"
                      : "border-border hover:border-primary/40"
                  }`}
                >
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
                    onChange={handleFileChange(setIdDoc, "id_document")}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    data-testid="input-id-document"
                  />
                  {idDoc.state === "uploading" ? (
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      <p className="text-sm text-muted-foreground">Uploading…</p>
                    </div>
                  ) : idDoc.state === "done" ? (
                    <div className="flex flex-col items-center gap-2">
                      <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                      <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                        {idDoc.file?.name ?? "Uploaded"} — Tap to replace
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <Upload className="h-6 w-6 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">Click or drag to upload</p>
                    </div>
                  )}
                </div>
                {idDoc.error && (
                  <p className="text-xs text-destructive" data-testid="text-id-error">{idDoc.error}</p>
                )}
              </div>

              {/* Selfie */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Camera className="h-4 w-4 text-muted-foreground" />
                  Selfie / Photo <span className="text-destructive">*</span>
                </Label>
                <p className="text-xs text-muted-foreground">
                  A clear, recent photo of your face. No sunglasses or hats.
                </p>
                <div
                  className={`relative border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                    selfie.state === "done"
                      ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20"
                      : selfie.state === "error"
                      ? "border-destructive bg-destructive/5"
                      : "border-border hover:border-primary/40"
                  }`}
                >
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/heic"
                    onChange={handleFileChange(setSelfie, "selfie")}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    data-testid="input-selfie"
                  />
                  {selfie.state === "uploading" ? (
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      <p className="text-sm text-muted-foreground">Uploading…</p>
                    </div>
                  ) : selfie.state === "done" ? (
                    <div className="flex flex-col items-center gap-2">
                      <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                      <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                        {selfie.file?.name ?? "Uploaded"} — Tap to replace
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <Upload className="h-6 w-6 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">Click or drag to upload</p>
                    </div>
                  )}
                </div>
                {selfie.error && (
                  <p className="text-xs text-destructive" data-testid="text-selfie-error">{selfie.error}</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Confirmations */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Confirmations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="has_transport"
                  checked={hasTransport}
                  onCheckedChange={(v) => setHasTransport(v === true)}
                  data-testid="checkbox-transport"
                />
                <Label htmlFor="has_transport" className="text-sm leading-relaxed cursor-pointer">
                  I confirm that I have reliable transportation and can travel to vehicle inspection locations as assigned.
                </Label>
              </div>

              <div className="flex items-start gap-3">
                <Checkbox
                  id="agreement"
                  checked={agreement}
                  onCheckedChange={(v) => setAgreement(v === true)}
                  data-testid="checkbox-agreement"
                />
                <Label htmlFor="agreement" className="text-sm leading-relaxed cursor-pointer">
                  I understand I am an independent contractor and must follow RideCheck's inspection process,
                  conduct standards, and data quality requirements.
                </Label>
              </div>
            </CardContent>
          </Card>

          <Button
            type="submit"
            className="w-full"
            size="lg"
            disabled={submitting || idDoc.state === "uploading" || selfie.state === "uploading"}
            data-testid="button-submit-verification"
          >
            {submitting ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Submitting…
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" />
                Submit Verification
              </span>
            )}
          </Button>

          <p className="text-xs text-center text-muted-foreground pb-4">
            Your documents are encrypted and only accessible to authorized RideCheck staff.
            Approval typically takes 1–2 business days.
          </p>
        </form>
      </div>
    </div>
  );
}
